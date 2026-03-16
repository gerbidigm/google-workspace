/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { google, docs_v1 } from 'googleapis';
import { AuthManager } from '../../auth/AuthManager';
import { extractDocId } from '../../utils/IdUtils';
import { logToFile } from '../../utils/logger';
import { gaxiosOptions } from '../../utils/GaxiosConfig';

interface ImageInfo {
  objectId: string;
  contentUri: string;
  mimeType?: string;
  imageProperties?: docs_v1.Schema$ImageProperties;
  positioning?: {
    layout?: string;
    leftOffset?: number;
    topOffset?: number;
  };
  tabId?: string;
  tabTitle?: string;
}

/**
 * Service for extracting images from Google Docs.
 * Uses the positioned_objects field from the Docs API.
 */
export class DocsImageService {
  constructor(private authManager: AuthManager) {}

  private async getDocsClient(): Promise<docs_v1.Docs> {
    const auth = await this.authManager.getAuthenticatedClient();
    const options = { ...gaxiosOptions, auth };
    return google.docs({ version: 'v1', ...options });
  }

  /**
   * Recursively flattens a tab tree into a single array.
   */
  private _flattenTabs(tabs: docs_v1.Schema$Tab[]): docs_v1.Schema$Tab[] {
    return tabs.flatMap((tab) => {
      const children = tab.childTabs ? this._flattenTabs(tab.childTabs) : [];
      return [tab, ...children];
    });
  }

  /**
   * Extract all images from a Google Doc.
   * Supports both legacy positionedObjects and multi-tab documents.
   */
  public extractImages = async ({
    documentId,
    tabId,
  }: {
    documentId: string;
    tabId?: string;
  }) => {
    logToFile(
      `[DocsImageService] Starting extractImages for document: ${documentId}, tabId: ${tabId}`,
    );
    try {
      const id = extractDocId(documentId) || documentId;
      const docs = await this.getDocsClient();

      // Fetch the document with tabs and positioned objects
      const res = await docs.documents.get({
        documentId: id,
        fields: 'tabs',
        includeTabsContent: true,
      });

      const images: ImageInfo[] = [];
      const tabs = this._flattenTabs(res.data.tabs || []);

      if (tabs.length === 0) {
        logToFile(`[DocsImageService] No tabs found in document: ${id}`);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ images: [] }, null, 2),
            },
          ],
        };
      }

      // Filter to specific tab if requested
      const tabsToProcess = tabId
        ? tabs.filter((t) => t.tabProperties?.tabId === tabId)
        : tabs;

      if (tabId && tabsToProcess.length === 0) {
        throw new Error(`Tab with ID ${tabId} not found.`);
      }

      // Extract images from each tab
      for (const tab of tabsToProcess) {
        const positionedObjects = tab.documentTab?.positionedObjects;
        const currentTabId = tab.tabProperties?.tabId;
        const currentTabTitle = tab.tabProperties?.title;

        if (!positionedObjects) {
          continue;
        }

        // positionedObjects is a map: objectId -> PositionedObject
        for (const [objectId, positionedObject] of Object.entries(
          positionedObjects,
        )) {
          const embeddedObject =
            positionedObject.positionedObjectProperties?.embeddedObject;

          if (!embeddedObject) {
            continue;
          }

          // Check if this positioned object contains an image
          const contentUri = embeddedObject.imageProperties?.contentUri;
          if (!contentUri) {
            continue;
          }

          // Extract positioning info
          const positioning = positionedObject.positionedObjectProperties
            ?.positioning?.layout
            ? {
                layout:
                  positionedObject.positionedObjectProperties.positioning
                    .layout,
                leftOffset:
                  positionedObject.positionedObjectProperties.positioning
                    .leftOffset?.magnitude,
                topOffset:
                  positionedObject.positionedObjectProperties.positioning
                    .topOffset?.magnitude,
              }
            : undefined;

          images.push({
            objectId,
            contentUri,
            mimeType: embeddedObject.imageProperties.contentUri
              ? this._inferMimeType(
                  embeddedObject.imageProperties.contentUri,
                )
              : undefined,
            imageProperties: embeddedObject.imageProperties,
            positioning,
            tabId: currentTabId || undefined,
            tabTitle: currentTabTitle || undefined,
          });
        }
      }

      logToFile(
        `[DocsImageService] Found ${images.length} images in document: ${id}`,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ images, count: images.length }, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(
        `[DocsImageService] Error during extractImages: ${errorMessage}`,
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

  /**
   * Infer MIME type from content URI extension.
   */
  private _inferMimeType(uri: string): string | undefined {
    const ext = uri.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      bmp: 'image/bmp',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    };
    return ext ? mimeTypes[ext] : undefined;
  }

  /**
   * Insert an image into a Google Doc at a specified position.
   */
  public insertImage = async ({
    documentId,
    imageUri,
    driveFileId,
    position = 'end',
    width,
    height,
    tabId,
  }: {
    documentId: string;
    imageUri?: string;
    driveFileId?: string;
    position?: string | number;
    width?: number;
    height?: number;
    tabId?: string;
  }) => {
    logToFile(
      `[DocsImageService] Starting insertImage for document: ${documentId}`,
    );

    try {
      // Validate inputs
      if (!imageUri && !driveFileId) {
        throw new Error('Either imageUri or driveFileId must be provided');
      }

      if (imageUri && driveFileId) {
        throw new Error(
          'Cannot provide both imageUri and driveFileId. Please provide only one.',
        );
      }

      const id = extractDocId(documentId) || documentId;
      const docs = await this.getDocsClient();

      // If driveFileId is provided, convert to content link
      let uri = imageUri;
      if (driveFileId) {
        uri = `https://drive.google.com/uc?id=${driveFileId}`;
        logToFile(`[DocsImageService] Using Drive file ID: ${driveFileId}`);
      }

      // Determine insertion index
      let index: number;

      if (position === 'beginning') {
        index = 1;
      } else if (position === 'end' || typeof position !== 'number') {
        // Get document to find end index
        const res = await docs.documents.get({
          documentId: id,
          fields: 'body',
        });

        const content = res.data.body?.content;
        const lastElement = content?.[content.length - 1];
        const endIndex = lastElement?.endIndex || 1;
        index = Math.max(1, endIndex - 1);
      } else {
        index = position;
        if (index < 1) {
          throw new Error('Position index must be >= 1');
        }
      }

      // Build the insert image request
      const insertImageRequest: docs_v1.Schema$InsertInlineImageRequest = {
        uri: uri!,
        location: {
          index: index,
          ...(tabId && { tabId }),
        },
      };

      // Add size if provided
      if (width || height) {
        insertImageRequest.objectSize = {
          width: width ? { magnitude: width, unit: 'PT' } : undefined,
          height: height ? { magnitude: height, unit: 'PT' } : undefined,
        };
      }

      // Execute the insert
      logToFile(
        `[DocsImageService] Inserting image at index ${index} from URI: ${uri}`,
      );
      await docs.documents.batchUpdate({
        documentId: id,
        requestBody: {
          requests: [
            {
              insertInlineImage: insertImageRequest,
            },
          ],
        },
      });

      logToFile(
        `[DocsImageService] Image inserted successfully into document: ${id}`,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              documentId: id,
              imageUri: uri,
              insertedAt: index,
              success: true,
            }),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(
        `[DocsImageService] Error during insertImage: ${errorMessage}`,
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

  /**
   * Create a Google Doc with mixed text and image content.
   */
  public createWithImages = async ({
    title,
    content,
  }: {
    title: string;
    content: Array<
      | { type: 'text'; text: string }
      | { type: 'image'; uri: string; width?: number; height?: number }
      | { type: 'image'; driveFileId: string; width?: number; height?: number }
    >;
  }) => {
    logToFile(
      `[DocsImageService] Starting createWithImages with title: ${title}`,
    );

    try {
      const docs = await this.getDocsClient();

      // Create the document
      logToFile('[DocsImageService] Creating document');
      const doc = await docs.documents.create({
        requestBody: { title },
      });
      const documentId = doc.data.documentId!;
      const docTitle = doc.data.title!;

      logToFile(`[DocsImageService] Document created: ${documentId}`);

      // Build batch update requests for content
      const requests: docs_v1.Schema$Request[] = [];
      let currentIndex = 1; // Start at index 1 (after the title)

      for (const item of content) {
        if (item.type === 'text') {
          // Insert text
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: item.text,
            },
          });
          currentIndex += item.text.length;
        } else if (item.type === 'image') {
          // Determine URI
          let uri: string;
          if ('uri' in item) {
            uri = item.uri;
          } else if ('driveFileId' in item) {
            uri = `https://drive.google.com/uc?id=${item.driveFileId}`;
          } else {
            throw new Error('Image must have either uri or driveFileId');
          }

          // Insert image
          const insertImageRequest: docs_v1.Schema$InsertInlineImageRequest = {
            uri: uri,
            location: { index: currentIndex },
          };

          if (item.width || item.height) {
            insertImageRequest.objectSize = {
              width: item.width
                ? { magnitude: item.width, unit: 'PT' }
                : undefined,
              height: item.height
                ? { magnitude: item.height, unit: 'PT' }
                : undefined,
            };
          }

          requests.push({
            insertInlineImage: insertImageRequest,
          });

          // Images don't advance the index in the same way
          // We need to account for the image object (typically 1 character)
          currentIndex += 1;
        }
      }

      // Execute all requests in a single batch
      if (requests.length > 0) {
        logToFile(
          `[DocsImageService] Executing ${requests.length} content requests`,
        );
        await docs.documents.batchUpdate({
          documentId: documentId,
          requestBody: { requests },
        });
      }

      logToFile(
        `[DocsImageService] Document created successfully with ${content.length} content items`,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              documentId,
              title: docTitle,
              contentItems: content.length,
              webViewLink: `https://docs.google.com/document/d/${documentId}/edit`,
            }),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(
        `[DocsImageService] Error during createWithImages: ${errorMessage}`,
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
