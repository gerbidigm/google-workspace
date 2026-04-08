/**
 * @license
 * Copyright 2026 Charlie Voiselle
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Auth } from 'googleapis';
import type { AuthManager } from '../../auth/AuthManager';
import { logToFile } from '../../utils/logger';

const GENERATIVE_LANGUAGE_BASE =
  'https://generativelanguage.googleapis.com/v1beta';

interface ImageInput {
  url?: string;
  base64?: string;
  mimeType?: string;
}

interface DescribeImageResult {
  description: string;
  imageUrl?: string;
  model: string;
  error?: string;
}

interface BatchDescribeResult {
  results: DescribeImageResult[];
  totalImages: number;
  successCount: number;
  errorCount: number;
}

/**
 * Service for Gemini API image analysis.
 *
 * Auth priority:
 *   1. GEMINI_API_KEY env var  →  uses @google/generative-ai SDK
 *   2. authManager (OAuth)     →  calls the Generative Language REST API
 *      directly using the user's access token (requires the
 *      `generative-language` OAuth scope).
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private apiKey: string | null = null;
  private authManager: AuthManager | null = null;

  constructor(authManager?: AuthManager) {
    this.apiKey = process.env['GEMINI_API_KEY'] || null;
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    } else if (authManager) {
      this.authManager = authManager;
    }
  }

  private checkInitialized(): void {
    if (!this.genAI && !this.authManager) {
      throw new Error(
        'Gemini API not available. Either set the GEMINI_API_KEY environment ' +
          'variable or ensure the generative-language OAuth scope was granted ' +
          'during sign-in.',
      );
    }
  }

  // ── OAuth REST helpers ────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    const client =
      (await this.authManager!.getAuthenticatedClient()) as Auth.OAuth2Client;
    const tokenResponse = await client.getAccessToken();
    if (!tokenResponse.token) {
      throw new Error('Failed to obtain OAuth access token for Gemini.');
    }
    return tokenResponse.token;
  }

  /**
   * Call the Generative Language REST API with the user's OAuth token.
   * Returns the first candidate's text.
   */
  private async generateContentOAuth(
    model: string,
    parts: unknown[],
  ): Promise<string> {
    const token = await this.getAccessToken();
    const url = `${GENERATIVE_LANGUAGE_BASE}/models/${model}:generateContent`;

    const body = {
      contents: [{ parts }],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Generative Language API error ${response.status}: ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No text in Generative Language API response.');
    }
    return text;
  }

  // ── Image loading ─────────────────────────────────────────────────────────

  private async urlToInlineData(
    url: string,
    mimeType?: string,
  ): Promise<{ inlineData: { data: string; mimeType: string } }> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return {
      inlineData: {
        data: base64,
        mimeType:
          mimeType || response.headers.get('content-type') || 'image/jpeg',
      },
    };
  }

  private async resolveImagePart(image: ImageInput) {
    if (image.url) {
      return this.urlToInlineData(image.url, image.mimeType);
    } else if (image.base64) {
      return {
        inlineData: {
          data: image.base64,
          mimeType: image.mimeType || 'image/jpeg',
        },
      };
    }
    throw new Error('Either url or base64 must be provided');
  }

  // ── Public tools ──────────────────────────────────────────────────────────

  /**
   * Describe a single image using Gemini.
   */
  public describeImage = async ({
    image,
    prompt = 'Describe this image in detail.',
    model = 'gemini-1.5-flash',
  }: {
    image: ImageInput;
    prompt?: string;
    model?: string;
  }) => {
    logToFile(`[GeminiService] Starting describeImage with model: ${model}`);
    try {
      this.checkInitialized();

      const imagePart = await this.resolveImagePart(image);
      let description: string;

      if (this.genAI) {
        const result = await this.genAI
          .getGenerativeModel({ model })
          .generateContent([prompt, imagePart]);
        description = result.response.text();
      } else {
        description = await this.generateContentOAuth(model, [
          { text: prompt },
          imagePart,
        ]);
      }

      logToFile(
        `[GeminiService] Successfully described image (${description.length} chars)`,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { description, imageUrl: image.url, model },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(`[GeminiService] Error during describeImage: ${errorMessage}`);
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
      };
    }
  };

  /**
   * Describe multiple images in batch, with optional shared context.
   */
  public describeImageBatch = async ({
    images,
    prompt = 'Describe each image briefly.',
    sharedContext,
    model = 'gemini-1.5-flash',
    individualPrompts = false,
  }: {
    images: ImageInput[];
    prompt?: string;
    sharedContext?: string;
    model?: string;
    individualPrompts?: boolean;
  }) => {
    logToFile(
      `[GeminiService] Starting describeImageBatch with ${images.length} images, model: ${model}`,
    );
    try {
      this.checkInitialized();

      if (images.length === 0) throw new Error('No images provided');
      if (images.length > 50)
        throw new Error('Maximum 50 images per batch request');

      let results: DescribeImageResult[];

      if (individualPrompts) {
        results = await Promise.all(
          images.map(async (image, index) => {
            try {
              const imagePart = await this.resolveImagePart(image);
              const imagePrompt = sharedContext
                ? `${sharedContext}\n\n${prompt}`
                : prompt;

              let description: string;
              if (this.genAI) {
                const result = await this.genAI
                  .getGenerativeModel({ model })
                  .generateContent([imagePrompt, imagePart]);
                description = result.response.text();
              } else {
                description = await this.generateContentOAuth(model, [
                  { text: imagePrompt },
                  imagePart,
                ]);
              }

              logToFile(
                `[GeminiService] Described image ${index + 1}/${images.length}`,
              );
              return { description, imageUrl: image.url, model };
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              logToFile(
                `[GeminiService] Error describing image ${index + 1}: ${errorMessage}`,
              );
              return {
                description: '',
                imageUrl: image.url,
                model,
                error: errorMessage,
              };
            }
          }),
        );
      } else {
        // All images in one request
        const imageParts = await Promise.all(
          images.map((image) => this.resolveImagePart(image)),
        );

        const batchPrompt =
          `${sharedContext ? sharedContext + '\n\n' : ''}${prompt}\n\n` +
          `There are ${images.length} images. Number your descriptions (1, 2, 3, etc.).`;

        let fullDescription: string;
        if (this.genAI) {
          const result = await this.genAI
            .getGenerativeModel({ model })
            .generateContent([batchPrompt, ...imageParts]);
          fullDescription = result.response.text();
        } else {
          fullDescription = await this.generateContentOAuth(model, [
            { text: batchPrompt },
            ...imageParts,
          ]);
        }

        const descriptions = fullDescription
          .split(/\n(?=\d+[.):]\s)/)
          .filter((d) => d.trim());

        results = images.map((image, index) => ({
          description: descriptions[index] || fullDescription,
          imageUrl: image.url,
          model,
        }));

        logToFile(`[GeminiService] Described ${images.length} images in batch`);
      }

      const successCount = results.filter((r) => !r.error).length;
      const errorCount = results.filter((r) => r.error).length;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                results,
                totalImages: images.length,
                successCount,
                errorCount,
              } as BatchDescribeResult,
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(
        `[GeminiService] Error during describeImageBatch: ${errorMessage}`,
      );
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
      };
    }
  };
}
