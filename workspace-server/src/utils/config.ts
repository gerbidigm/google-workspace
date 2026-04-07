/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { logToFile } from './logger';

export interface WorkspaceConfig {
  clientId: string;
  clientSecret?: string;
  cloudFunctionUrl: string;
}

const DEFAULT_CONFIG: WorkspaceConfig = {
  clientId:
    '338689075775-o75k922vn5fdl18qergr96rp8g63e4d7.apps.googleusercontent.com',
  cloudFunctionUrl: 'https://google-workspace-extension.geminicli.com',
};

/**
 * Loads the configuration. Currently uses defaults, but can be extended
 * to read from environment variables or a configuration file.
 *
 * When WORKSPACE_CLIENT_SECRET is set, the server uses a direct Desktop App
 * OAuth flow (no cloud function required) — useful for users supplying their
 * own Google Cloud project credentials.
 */
export function loadConfig(): WorkspaceConfig {
  const config: WorkspaceConfig = {
    clientId: process.env['WORKSPACE_CLIENT_ID'] || DEFAULT_CONFIG.clientId,
    clientSecret: process.env['WORKSPACE_CLIENT_SECRET'] || undefined,
    cloudFunctionUrl:
      process.env['WORKSPACE_CLOUD_FUNCTION_URL'] ||
      DEFAULT_CONFIG.cloudFunctionUrl,
  };

  const maskedClientId =
    config.clientId.length > 2
      ? `...${config.clientId.slice(-2)}`
      : config.clientId;
  logToFile(
    `Loaded config: clientId=${maskedClientId}, cloudFunctionUrl=${config.cloudFunctionUrl}`,
  );
  return config;
}
