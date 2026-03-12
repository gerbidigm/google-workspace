/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { google, gmail_v1 } from 'googleapis';
import { AuthManager } from '../../auth/AuthManager';
import { logToFile } from '../../utils/logger';
import { gaxiosOptions } from '../../utils/GaxiosConfig';

/**
 * FlexibleGmailService provides advanced Gmail fetching capabilities
 * with fine-grained control over fields and format.
 *
 * This service allows AI agents to:
 * - Specify exactly which fields to retrieve (reduces bandwidth and processing)
 * - Use any Gmail API format (minimal, full, raw, metadata)
 * - Optimize queries for specific use cases
 */
export class FlexibleGmailService {
  constructor(private authManager: AuthManager) {}

  private async getGmailClient(): Promise<gmail_v1.Gmail> {
    const auth = await this.authManager.getAuthenticatedClient();
    const options = { ...gaxiosOptions, auth };
    return google.gmail({ version: 'v1', ...options });
  }

  private handleError(error: unknown, context: string) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logToFile(`Error during ${context}: ${errorMessage}`);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: errorMessage }),
        },
      ],
    };
  }

  /**
   * Fetch a Gmail message with flexible field selection.
   *
   * Supports all Gmail API formats and allows specifying exact fields to retrieve.
   * Use the `fields` parameter to reduce response size and processing time.
   *
   * @param messageId - The Gmail message ID to fetch
   * @param format - The format type: 'minimal' | 'full' | 'raw' | 'metadata'
   * @param fields - Optional field mask (Gmail API fields parameter)
   *                 Example: "id,threadId,labelIds,snippet,payload/headers"
   *                 See: https://developers.google.com/gmail/api/guides/performance#partial-response
   * @param metadataHeaders - For 'metadata' format: array of header names to include
   *                          Example: ["From", "To", "Subject", "Date"]
   *
   * @returns The message data with requested fields
   */
  public fetchFlexible = async ({
    messageId,
    format = 'full',
    fields,
    metadataHeaders,
  }: {
    messageId: string;
    format?: 'minimal' | 'full' | 'raw' | 'metadata';
    fields?: string;
    metadataHeaders?: string[];
  }) => {
    try {
      logToFile(
        `Flexible Gmail fetch - messageId: ${messageId}, format: ${format}, fields: ${fields || 'all'}, metadataHeaders: ${metadataHeaders?.join(',') || 'none'}`,
      );

      const gmail = await this.getGmailClient();

      // Build the request parameters
      const requestParams: gmail_v1.Params$Resource$Users$Messages$Get = {
        userId: 'me',
        id: messageId,
        format,
      };

      // Add fields parameter if specified
      if (fields) {
        requestParams.fields = fields;
      }

      // Add metadataHeaders if format is metadata
      if (format === 'metadata' && metadataHeaders && metadataHeaders.length > 0) {
        requestParams.metadataHeaders = metadataHeaders;
      }

      const response = await gmail.users.messages.get(requestParams);

      logToFile(
        `Successfully fetched message ${messageId} with format ${format}`,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error) {
      return this.handleError(error, 'gerbidigm.gmail.fetchFlexible');
    }
  };

  /**
   * Batch fetch multiple messages with flexible field selection.
   * More efficient than calling fetchFlexible multiple times.
   *
   * @param messageIds - Array of Gmail message IDs to fetch
   * @param format - The format type for all messages
   * @param fields - Optional field mask applied to all messages
   * @param metadataHeaders - For 'metadata' format: array of header names
   *
   * @returns Array of message data
   */
  public batchFetchFlexible = async ({
    messageIds,
    format = 'metadata',
    fields,
    metadataHeaders,
  }: {
    messageIds: string[];
    format?: 'minimal' | 'full' | 'raw' | 'metadata';
    fields?: string;
    metadataHeaders?: string[];
  }) => {
    try {
      if (messageIds.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                messages: [],
                error: 'No message IDs provided',
              }),
            },
          ],
        };
      }

      if (messageIds.length > 100) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                error: 'Too many message IDs. Maximum is 100, got ' + messageIds.length,
              }),
            },
          ],
        };
      }

      logToFile(
        `Batch flexible fetch - ${messageIds.length} messages, format: ${format}, fields: ${fields || 'all'}`,
      );

      const gmail = await this.getGmailClient();

      // Fetch all messages in parallel
      const fetchPromises = messageIds.map(async (messageId) => {
        try {
          const requestParams: gmail_v1.Params$Resource$Users$Messages$Get = {
            userId: 'me',
            id: messageId,
            format,
          };

          if (fields) {
            requestParams.fields = fields;
          }

          if (format === 'metadata' && metadataHeaders && metadataHeaders.length > 0) {
            requestParams.metadataHeaders = metadataHeaders;
          }

          const response = await gmail.users.messages.get(requestParams);
          return {
            messageId,
            success: true,
            data: response.data,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logToFile(`Error fetching message ${messageId}: ${errorMessage}`);
          return {
            messageId,
            success: false,
            error: errorMessage,
          };
        }
      });

      const results = await Promise.all(fetchPromises);

      const successful = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      logToFile(
        `Batch fetch complete: ${successful.length} successful, ${failed.length} failed`,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                summary: {
                  total: messageIds.length,
                  successful: successful.length,
                  failed: failed.length,
                },
                messages: successful.map((r) => r.data),
                errors: failed.length > 0 ? failed : undefined,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.handleError(error, 'gerbidigm.gmail.batchFetchFlexible');
    }
  };
}
