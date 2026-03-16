/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthManager } from '../../auth/AuthManager';
import { logToFile } from '../../utils/logger';

/**
 * Example custom service for Gerbidigm-specific tools.
 * This service is completely isolated from upstream code.
 */
export class ExampleCustomService {
  constructor(private authManager: AuthManager) {}

  /**
   * Example tool: echoes back a message with metadata
   */
  public echo = async ({ message }: { message: string }) => {
    try {
      logToFile(`[Gerbidigm] Echo called with: ${message}`);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                echo: message,
                timestamp: new Date().toISOString(),
                source: 'gerbidigm-custom-tool',
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
      return {
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
   * Add more custom tool implementations here
   */
  public anotherTool = async (params: { foo: string }) => {
    // Your implementation
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ result: 'success', data: params }),
        },
      ],
    };
  };
}
