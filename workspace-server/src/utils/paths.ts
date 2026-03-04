/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

function findProjectRoot(): string {
  let dir = __dirname;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'gemini-extension.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  // Not running inside a Gemini CLI extension context (e.g. Claude Desktop).
  // Use a stable per-user directory for token storage.
  return path.join(os.homedir(), '.google-workspace-mcp');
}

// Construct an absolute path to the project root.
export const PROJECT_ROOT = findProjectRoot();
export const ENCRYPTED_TOKEN_PATH = path.join(
  PROJECT_ROOT,
  'gemini-cli-workspace-token.json',
);
export const ENCRYPTION_MASTER_KEY_PATH = path.join(
  PROJECT_ROOT,
  '.gemini-cli-workspace-master-key',
);
