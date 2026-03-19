/**
 * @license
 * Copyright 2026 Charlie Voiselle
 * SPDX-License-Identifier: Apache-2.0
 */

import { google, drive_v3 } from 'googleapis';
import { AuthManager } from '../../auth/AuthManager';
import { logToFile } from '../../utils/logger';
import { gaxiosOptions } from '../../utils/GaxiosConfig';
import * as fs from 'node:fs';
import * as path from 'node:path';

const MIME_TYPE_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50MB

export class DriveUploadService {
  constructor(private authManager: AuthManager) {}

  private async getDriveClient(): Promise<drive_v3.Drive> {
    const auth = await this.authManager.getAuthenticatedClient();
    const options = { ...gaxiosOptions, auth };
    return google.drive({ version: 'v3', ...options });
  }

  public uploadImage = async ({
    localPath,
    name,
    folderId,
    makePublic = false,
  }: {
    localPath: string;
    name?: string;
    folderId?: string;
    makePublic?: boolean;
  }) => {
    logToFile(
      `[DriveUploadService] Starting uploadImage for file: ${localPath}`,
    );

    try {
      // Validate file exists
      if (!fs.existsSync(localPath)) {
        throw new Error(`File not found: ${localPath}`);
      }

      // Get file stats
      const stats = fs.statSync(localPath);
      if (stats.size > MAX_IMAGE_SIZE) {
        throw new Error(
          `File size ${stats.size} bytes exceeds maximum allowed size of ${MAX_IMAGE_SIZE} bytes (50MB)`,
        );
      }

      // Determine MIME type from extension
      const ext = path.extname(localPath).toLowerCase();
      const mimeType = MIME_TYPE_MAP[ext];
      if (!mimeType) {
        throw new Error(
          `Unsupported file extension: ${ext}. Supported: ${Object.keys(MIME_TYPE_MAP).join(', ')}`,
        );
      }

      // Use provided name or default to filename
      const fileName = name || path.basename(localPath);

      const drive = await this.getDriveClient();

      // Prepare file metadata
      const fileMetadata: drive_v3.Schema$File = {
        name: fileName,
        mimeType: mimeType,
      };

      if (folderId) {
        fileMetadata.parents = [folderId];
      }

      // Upload file
      logToFile(`[DriveUploadService] Uploading file with multipart upload`);
      const media = {
        mimeType: mimeType,
        body: fs.createReadStream(localPath),
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, mimeType, size, webViewLink, webContentLink',
        supportsAllDrives: true,
      });

      logToFile(
        `[DriveUploadService] File uploaded successfully: ${file.data.id}`,
      );

      // Make public if requested
      if (makePublic) {
        logToFile(`[DriveUploadService] Making file publicly accessible`);
        await drive.permissions.create({
          fileId: file.data.id!,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          },
          supportsAllDrives: true,
        });
      }

      // Get the direct content link
      const contentLink = `https://drive.google.com/uc?id=${file.data.id}`;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              fileId: file.data.id,
              name: file.data.name,
              mimeType: file.data.mimeType,
              size: file.data.size,
              webViewLink: file.data.webViewLink,
              contentLink: contentLink,
            }),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(
        `[DriveUploadService] Error during uploadImage: ${errorMessage}`,
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
   * Copy any file in Google Drive (including Google Docs, Sheets, Slides).
   * Returns the new file's ID and web link.
   */
  public copyFile = async ({
    fileId,
    name,
    folderId,
  }: {
    fileId: string;
    name?: string;
    folderId?: string;
  }) => {
    logToFile(`[DriveUploadService] copyFile: ${fileId}`);
    try {
      const drive = await this.getDriveClient();

      // Fetch original name as fallback
      const original = await drive.files.get({
        fileId,
        fields: 'name',
        supportsAllDrives: true,
      });

      const copyName = name ?? `Copy of ${original.data.name ?? fileId}`;

      const requestBody: drive_v3.Schema$File = { name: copyName };
      if (folderId) {
        requestBody.parents = [folderId];
      }

      const copy = await drive.files.copy({
        fileId,
        requestBody,
        fields: 'id,name,mimeType,webViewLink',
        supportsAllDrives: true,
      });

      logToFile(`[DriveUploadService] copyFile succeeded: ${copy.data.id}`);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              fileId: copy.data.id,
              name: copy.data.name,
              mimeType: copy.data.mimeType,
              webViewLink: copy.data.webViewLink,
            }),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(`[DriveUploadService] Error during copyFile: ${errorMessage}`);
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
