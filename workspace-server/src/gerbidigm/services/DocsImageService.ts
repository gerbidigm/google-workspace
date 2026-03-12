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
}
