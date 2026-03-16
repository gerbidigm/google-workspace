/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthManager } from '../auth/AuthManager';
import type { PeopleService } from '../services/PeopleService';
import { ExampleCustomService } from './services/ExampleCustomService';
import { FlexibleGmailService } from './services/FlexibleGmailService';
import { DocsImageService } from './services/DocsImageService';
import { GeminiService } from './services/GeminiService';
import { DriveUploadService } from './services/DriveUploadService';

/**
 * Registration options passed from main index.ts
 */
export interface RegisterOptions {
  separator: string; // '.' or '_' for tool names
  readOnlyToolProps: {
    annotations: {
      readOnlyHint: boolean;
    };
  };
}

/**
 * Additional services that may be passed from index.ts
 */
export interface GerbidigmServices {
  peopleService?: PeopleService;
}

/**
 * Central registration function for all Gerbidigm custom tools.
 * This is the ONLY function called from index.ts, keeping the patch minimal.
 *
 * To add new tools:
 * 1. Create a service in ./services/
 * 2. Instantiate it below
 * 3. Register tools using server.registerTool()
 *
 * @param server - The MCP server instance
 * @param authManager - Shared auth manager
 * @param options - Configuration options (separator, readonly props, etc.)
 */
export async function registerGerbidigmTools(
  server: McpServer,
  authManager: AuthManager,
  options: RegisterOptions,
  services?: GerbidigmServices,
): Promise<void> {
  const { separator, readOnlyToolProps } = options;

  // Instantiate custom services
  const exampleService = new ExampleCustomService(authManager);
  const flexibleGmailService = new FlexibleGmailService(authManager);
  const docsImageService = new DocsImageService(authManager);
  const geminiService = new GeminiService();
  const driveUploadService = new DriveUploadService(authManager);

  // Register custom tools with a 'gerbidigm' prefix to avoid conflicts
  // Tool names will be normalized to 'gerbidigm_echo' or 'gerbidigm.echo'
  server.registerTool(
    `gerbidigm${separator}echo`,
    {
      description: 'Example custom tool that echoes back a message with metadata.',
      inputSchema: {
        message: z.string().describe('The message to echo back.'),
      },
    },
    exampleService.echo,
  );

  server.registerTool(
    `gerbidigm${separator}anotherTool`,
    {
      description: 'Another example custom tool.',
      inputSchema: {
        foo: z.string().describe('A sample parameter.'),
      },
      ...readOnlyToolProps, // Example of marking a tool as read-only
    },
    exampleService.anotherTool,
  );

  // Directory search tool: Makes the search capability of getUserProfile discoverable
  if (services?.peopleService) {
    server.registerTool(
      `gerbidigm${separator}searchDirectory`,
      {
        description:
          'Search the Google Workspace directory for users by name or email. Returns all matching users and contacts from the organization directory. Use this when you need to find someone but only have their name or partial email.',
        inputSchema: {
          query: z
            .string()
            .describe(
              'Name or email to search for (e.g., "John Smith", "john@", "smith"). Partial matches are supported.',
            ),
        },
        ...readOnlyToolProps,
      },
      async ({ query }: { query: string }) => {
        // Leverage the existing getUserProfile implementation which does directory search
        return services.peopleService!.getUserProfile({ name: query });
      },
    );
  }

  // Gmail flexible fetch tools
  server.registerTool(
    `gerbidigm${separator}gmail${separator}fetchFlexible`,
    {
      description:
        'Fetch a Gmail message with fine-grained control over fields and format. Supports partial response (field masks) to reduce bandwidth and processing time. Use this when you need specific email data or want to optimize performance.',
      inputSchema: {
        messageId: z.string().describe('The Gmail message ID to fetch.'),
        format: z
          .enum(['minimal', 'full', 'raw', 'metadata'])
          .optional()
          .default('full')
          .describe(
            'Format type: "minimal" (id, threadId only), "full" (complete message with body), "raw" (RFC 2822 format), "metadata" (headers only).',
          ),
        fields: z
          .string()
          .optional()
          .describe(
            'Optional field mask for partial response. Example: "id,threadId,labelIds,snippet,payload/headers". See Gmail API partial response documentation.',
          ),
        metadataHeaders: z
          .array(z.string())
          .optional()
          .describe(
            'For metadata format: array of header names to include (e.g., ["From", "To", "Subject", "Date"]).',
          ),
      },
      ...readOnlyToolProps,
    },
    flexibleGmailService.fetchFlexible,
  );

  server.registerTool(
    `gerbidigm${separator}gmail${separator}batchFetchFlexible`,
    {
      description:
        'Batch fetch multiple Gmail messages with flexible field selection. More efficient than fetching messages one at a time. Supports up to 100 messages per request with the same format and field mask applied to all.',
      inputSchema: {
        messageIds: z
          .array(z.string())
          .min(1)
          .max(100)
          .describe('Array of Gmail message IDs to fetch (max 100).'),
        format: z
          .enum(['minimal', 'full', 'raw', 'metadata'])
          .optional()
          .default('metadata')
          .describe(
            'Format type applied to all messages: "minimal", "full", "raw", or "metadata".',
          ),
        fields: z
          .string()
          .optional()
          .describe(
            'Optional field mask applied to all messages. Example: "id,threadId,snippet,payload/headers".',
          ),
        metadataHeaders: z
          .array(z.string())
          .optional()
          .describe(
            'For metadata format: array of header names to include in all messages.',
          ),
      },
      ...readOnlyToolProps,
    },
    flexibleGmailService.batchFetchFlexible,
  );

  // Docs image extraction tool
  server.registerTool(
    `gerbidigm${separator}docs${separator}extractImages`,
    {
      description:
        'Extract all images from a Google Doc, including their content URIs, properties, and positioning. Returns image metadata with download URLs. Use this to inventory images, extract diagrams, or backup document images.',
      inputSchema: {
        documentId: z
          .string()
          .describe(
            'The Google Doc ID or URL to extract images from. Can be a full URL or just the document ID.',
          ),
        tabId: z
          .string()
          .optional()
          .describe(
            'Optional tab ID to extract images from a specific tab. If omitted, extracts from all tabs.',
          ),
      },
      ...readOnlyToolProps,
    },
    docsImageService.extractImages,
  );

  // Gemini image analysis tools
  server.registerTool(
    `gerbidigm${separator}gemini${separator}describeImage`,
    {
      description:
        'Describe a single image using Gemini AI. Supports images from URLs (like those from docs.extractImages) or base64-encoded data. Returns detailed image description with configurable prompts and model selection.',
      inputSchema: {
        image: z
          .object({
            url: z
              .string()
              .optional()
              .describe('Image URL (e.g., from Google Docs contentUri)'),
            base64: z.string().optional().describe('Base64-encoded image data'),
            mimeType: z
              .string()
              .optional()
              .describe('MIME type (e.g., image/jpeg, image/png)'),
          })
          .describe('Image to analyze. Provide either url or base64.'),
        prompt: z
          .string()
          .optional()
          .default('Describe this image in detail.')
          .describe('Custom prompt for image analysis'),
        model: z
          .string()
          .optional()
          .default('gemini-1.5-flash')
          .describe('Gemini model to use (gemini-1.5-flash, gemini-1.5-pro)'),
      },
      ...readOnlyToolProps,
    },
    geminiService.describeImage,
  );

  server.registerTool(
    `gerbidigm${separator}gemini${separator}describeImageBatch`,
    {
      description:
        'Describe multiple images in batch using Gemini AI. More efficient than individual requests. Supports up to 50 images per batch with shared context and flexible prompting strategies. Perfect for analyzing all images from a document.',
      inputSchema: {
        images: z
          .array(
            z.object({
              url: z.string().optional(),
              base64: z.string().optional(),
              mimeType: z.string().optional(),
            }),
          )
          .min(1)
          .max(50)
          .describe('Array of images to analyze (max 50)'),
        prompt: z
          .string()
          .optional()
          .default('Describe each image briefly.')
          .describe('Prompt applied to all images'),
        sharedContext: z
          .string()
          .optional()
          .describe(
            'Shared context for all images (e.g., "These images are from a technical design document")',
          ),
        model: z
          .string()
          .optional()
          .default('gemini-1.5-flash')
          .describe('Gemini model to use'),
        individualPrompts: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'If true, process each image separately. If false, send all images in one request (more efficient but descriptions may be shorter)',
          ),
      },
      ...readOnlyToolProps,
    },
    geminiService.describeImageBatch,
  );

  // Drive image upload tool
  server.registerTool(
    `gerbidigm${separator}drive${separator}uploadImage`,
    {
      description:
        'Upload a local image file to Google Drive. The uploaded image can then be inserted into Google Docs. Supports PNG, JPEG, GIF, and SVG formats up to 50MB. Returns the Drive file ID and content link that can be used with docs.insertImage.',
      inputSchema: {
        localPath: z
          .string()
          .describe(
            'Absolute path to the local image file to upload (e.g., "/Users/name/image.png").',
          ),
        name: z
          .string()
          .optional()
          .describe(
            'Optional custom name for the file in Drive. Defaults to the original filename.',
          ),
        folderId: z
          .string()
          .optional()
          .describe(
            'Optional Google Drive folder ID to upload to. If not provided, uploads to root directory.',
          ),
        makePublic: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            'If true, makes the file viewable by anyone with the link. Required for inserting into docs in some cases.',
          ),
      },
    },
    driveUploadService.uploadImage,
  );

  // Docs insert image tool
  server.registerTool(
    `gerbidigm${separator}docs${separator}insertImage`,
    {
      description:
        'Insert an image into a Google Doc at a specified position. Supports images from public URLs or Google Drive file IDs. Images can be sized and positioned as needed.',
      inputSchema: {
        documentId: z
          .string()
          .describe(
            'The Google Doc ID or URL to insert the image into. Can be a full URL or just the document ID.',
          ),
        imageUri: z
          .string()
          .optional()
          .describe(
            'Public URL of the image to insert. Must be accessible without authentication.',
          ),
        driveFileId: z
          .string()
          .optional()
          .describe(
            'Google Drive file ID of the image to insert. Alternative to imageUri.',
          ),
        position: z
          .union([z.string(), z.number()])
          .optional()
          .default('end')
          .describe(
            'Where to insert the image: "beginning", "end", or a numeric index (>= 1). Defaults to "end".',
          ),
        width: z
          .number()
          .optional()
          .describe('Optional width in points (72 points = 1 inch).'),
        height: z
          .number()
          .optional()
          .describe('Optional height in points (72 points = 1 inch).'),
        tabId: z
          .string()
          .optional()
          .describe('Optional tab ID to insert into a specific tab.'),
      },
    },
    docsImageService.insertImage,
  );

  // Docs create with images tool
  server.registerTool(
    `gerbidigm${separator}docs${separator}createWithImages`,
    {
      description:
        'Create a new Google Doc with mixed text and image content in a single operation. This is a convenience wrapper that creates the document and inserts all content atomically. Perfect for generating reports, documentation, or presentations with embedded images.',
      inputSchema: {
        title: z.string().describe('The title for the new Google Doc.'),
        content: z
          .array(
            z.discriminatedUnion('type', [
              z.object({
                type: z.literal('text'),
                text: z.string().describe('Text content to insert.'),
              }),
              z.object({
                type: z.literal('image'),
                uri: z
                  .string()
                  .optional()
                  .describe('Public URL of the image to insert.'),
                driveFileId: z
                  .string()
                  .optional()
                  .describe('Google Drive file ID of the image to insert.'),
                width: z
                  .number()
                  .optional()
                  .describe('Optional width in points (72 points = 1 inch).'),
                height: z
                  .number()
                  .optional()
                  .describe('Optional height in points (72 points = 1 inch).'),
              }),
            ]),
          )
          .describe(
            'Array of content items (text blocks and images) to insert into the document in order.',
          ),
      },
    },
    docsImageService.createWithImages,
  );

  // Add more tool registrations here as you build them
  // server.registerTool(`gerbidigm${separator}yourTool`, {...}, yourService.yourMethod);

  const toolCount = 10 + (services?.peopleService ? 1 : 0);
  console.error(`Registered ${toolCount} Gerbidigm custom tools.`);
}
