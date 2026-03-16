/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { logToFile } from '../../utils/logger';

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
 * Requires GEMINI_API_KEY environment variable.
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private apiKey: string | null = null;

  constructor() {
    // Load API key from environment
    this.apiKey = process.env.GEMINI_API_KEY || null;
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
  }

  private checkInitialized(): void {
    if (!this.genAI || !this.apiKey) {
      throw new Error(
        'Gemini API not initialized. Set GEMINI_API_KEY environment variable.',
      );
    }
  }

  /**
   * Convert image URL to inline data format for Gemini API.
   */
  private async urlToInlineData(
    url: string,
    mimeType?: string,
  ): Promise<{ inlineData: { data: string; mimeType: string } }> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const inferredMimeType =
        mimeType || response.headers.get('content-type') || 'image/jpeg';

      return {
        inlineData: {
          data: base64,
          mimeType: inferredMimeType,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load image from URL: ${errorMessage}`);
    }
  }

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

      const genModel = this.genAI!.getGenerativeModel({ model });

      // Prepare image data
      let imagePart;
      if (image.url) {
        imagePart = await this.urlToInlineData(image.url, image.mimeType);
      } else if (image.base64) {
        imagePart = {
          inlineData: {
            data: image.base64,
            mimeType: image.mimeType || 'image/jpeg',
          },
        };
      } else {
        throw new Error('Either url or base64 must be provided');
      }

      // Generate description
      const result = await genModel.generateContent([prompt, imagePart]);
      const response = result.response;
      const description = response.text();

      logToFile(
        `[GeminiService] Successfully described image (${description.length} chars)`,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                description,
                imageUrl: image.url,
                model,
              },
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

      if (images.length === 0) {
        throw new Error('No images provided');
      }

      if (images.length > 50) {
        throw new Error('Maximum 50 images per batch request');
      }

      const genModel = this.genAI!.getGenerativeModel({ model });

      let results: DescribeImageResult[];

      if (individualPrompts) {
        // Process each image separately for individual descriptions
        results = await Promise.all(
          images.map(async (image, index) => {
            try {
              const imagePart = image.url
                ? await this.urlToInlineData(image.url, image.mimeType)
                : {
                    inlineData: {
                      data: image.base64!,
                      mimeType: image.mimeType || 'image/jpeg',
                    },
                  };

              const imagePrompt = sharedContext
                ? `${sharedContext}\n\n${prompt}`
                : prompt;

              const result = await genModel.generateContent([
                imagePrompt,
                imagePart,
              ]);
              const description = result.response.text();

              logToFile(
                `[GeminiService] Described image ${index + 1}/${images.length}`,
              );

              return {
                description,
                imageUrl: image.url,
                model,
              };
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
        // Process all images in one request with shared context
        const imageParts = await Promise.all(
          images.map((image) =>
            image.url
              ? this.urlToInlineData(image.url, image.mimeType)
              : {
                  inlineData: {
                    data: image.base64!,
                    mimeType: image.mimeType || 'image/jpeg',
                  },
                },
          ),
        );

        const contentParts = [];
        if (sharedContext) {
          contentParts.push(sharedContext);
        }
        contentParts.push(
          `${prompt}\n\nThere are ${images.length} images. Number your descriptions (1, 2, 3, etc.).`,
        );
        contentParts.push(...imageParts);

        const result = await genModel.generateContent(contentParts);
        const fullDescription = result.response.text();

        // Split the response by image (this is a simple split, may need refinement)
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
