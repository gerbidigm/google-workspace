/**
 * @license
 * Copyright 2026 Charlie Voiselle
 * SPDX-License-Identifier: Apache-2.0
 */

import { google, gmail_v1 } from 'googleapis';
import { AuthManager } from '../../auth/AuthManager';
import { logToFile } from '../../utils/logger';
import { gaxiosOptions } from '../../utils/GaxiosConfig';

/**
 * GmailLabelService provides Gmail label management utilities.
 *
 * Offers higher-level operations than the raw Gmail API, such as
 * creating an entire label path in one call (mkdir -p semantics).
 */
export class GmailLabelService {
  constructor(private authManager: AuthManager) {}

  private async getGmailClient(): Promise<gmail_v1.Gmail> {
    const auth = await this.authManager.getAuthenticatedClient();
    const options = { ...gaxiosOptions, auth };
    return google.gmail({ version: 'v1', ...options });
  }

  private handleError(error: unknown, context: string) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: `${context} failed: ${message}` }, null, 2),
        },
      ],
    };
  }

  /**
   * Create a label path like "A/B/C", creating any missing ancestors first.
   * Equivalent to `mkdir -p`. Already-existing segments are skipped.
   * Returns the leaf label's id, name, and a list of which segments were
   * created vs already existed.
   */
  public createLabelPath = async ({
    path,
    delimiter = '/',
    labelListVisibility = 'labelShow',
    messageListVisibility = 'show',
  }: {
    path: string;
    delimiter?: string;
    labelListVisibility?: 'labelShow' | 'labelHide' | 'labelShowIfUnread';
    messageListVisibility?: 'show' | 'hide';
  }) => {
    try {
      const gmail = await this.getGmailClient();

      // Fetch all existing labels once
      const listRes = await gmail.users.labels.list({ userId: 'me' });
      const existing = new Map(
        (listRes.data.labels ?? []).map((l) => [l.name!, l.id!]),
      );

      const segments = path.split(delimiter).filter(Boolean);
      if (segments.length === 0) {
        throw new Error('path must have at least one non-empty segment');
      }

      const results: { name: string; id: string; created: boolean }[] = [];

      let accumulated = '';
      for (const segment of segments) {
        accumulated = accumulated ? `${accumulated}/${segment}` : segment;

        if (existing.has(accumulated)) {
          results.push({
            name: accumulated,
            id: existing.get(accumulated)!,
            created: false,
          });
          logToFile(`Label already exists: ${accumulated}`);
        } else {
          const res = await gmail.users.labels.create({
            userId: 'me',
            requestBody: {
              name: accumulated,
              labelListVisibility,
              messageListVisibility,
            },
          });
          const id = res.data.id!;
          existing.set(accumulated, id);
          results.push({ name: accumulated, id, created: true });
          logToFile(`Created label: ${accumulated} (${id})`);
        }
      }

      const leaf = results[results.length - 1];
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { leafId: leaf.id, leafName: leaf.name, segments: results },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.handleError(error, 'gerbidigm.gmail.createLabelPath');
    }
  };
}
