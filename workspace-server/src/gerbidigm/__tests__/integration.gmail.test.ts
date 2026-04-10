/**
 * @license
 * Copyright 2026 Charlie Voiselle
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Gmail integration smoke test.
 *
 * Requires stored OAuth credentials (run `node scripts/auth-utils.js login`
 * first).  All tests are skipped gracefully when credentials are missing or
 * expired, so this file is safe to include in the normal `npm test` run.
 *
 * Run standalone:
 *   npx jest --testPathPatterns=integration.gmail
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { google } from 'googleapis';
import { OAuthCredentialStorage } from '../../auth/token-storage/oauth-credential-storage';
import { loadConfig } from '../../utils/config';

jest.mock('../../utils/logger');

// ---------------------------------------------------------------------------
// Credential setup
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
let skipReason: string | null = null;

beforeAll(async () => {
  const creds = await OAuthCredentialStorage.loadCredentials();

  if (!creds?.access_token) {
    skipReason =
      'No stored credentials (run: node scripts/auth-utils.js login)';
    return;
  }

  const isExpired =
    creds.expiry_date !== null &&
    creds.expiry_date !== undefined &&
    creds.expiry_date < Date.now();

  if (!isExpired) {
    accessToken = creds.access_token;
    return;
  }

  // Token is expired — try a silent refresh if we have what we need.
  const config = loadConfig();
  if (!creds.refresh_token || !config.clientSecret) {
    skipReason =
      'Access token expired and cannot refresh without CLIENT_SECRET ' +
      '(run: node scripts/auth-utils.js login)';
    return;
  }

  try {
    const oauth2 = new google.auth.OAuth2(config.clientId, config.clientSecret);
    oauth2.setCredentials(creds);
    const { credentials } = await oauth2.refreshAccessToken();
    accessToken = credentials.access_token ?? null;
    if (accessToken) await OAuthCredentialStorage.saveCredentials(credentials);
  } catch {
    skipReason = 'Token refresh failed (run: node scripts/auth-utils.js login)';
  }
}, 30_000);

const itIfAuthed = (name: string, fn: () => Promise<void>) =>
  it(
    name,
    async () => {
      if (!accessToken) {
        console.warn(`  ⚠  Skipping: ${skipReason}`);
        return;
      }
      await fn();
    },
    15_000,
  );

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Gmail integration', () => {
  itIfAuthed('can list labels', async () => {
    // Use native fetch — gaxios's dynamic import() fails in Jest's sandboxed VM.
    const res = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/labels',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    expect(res.ok).toBe(true);
    const body = (await res.json()) as { labels?: { name?: string }[] };
    expect(Array.isArray(body.labels)).toBe(true);
    expect(body.labels!.length).toBeGreaterThan(0);

    const names = body.labels!.map((l) => l.name);
    expect(names).toContain('INBOX');

    console.log(
      `  ✔  ${body.labels!.length} labels returned (INBOX confirmed)`,
    );
  });
});
