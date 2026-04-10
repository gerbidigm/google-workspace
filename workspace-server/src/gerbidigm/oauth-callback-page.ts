/**
 * @license
 * Copyright 2026 Charlie Voiselle
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates the HTML page shown to the user after an OAuth callback.
 *
 * If `isClaudeDesktop` is true the page auto-redirects to `claude://` after a
 * short countdown so the user is snapped back to the application.  It also
 * attempts `window.close()` for both clients; browsers only honour this when
 * the tab was opened programmatically, so a manual-close hint is always shown
 * as a fallback.
 */
export function oauthCallbackPage(opts: {
  success: boolean;
  isClaudeDesktop: boolean;
  errorMessage?: string;
}): string {
  const { success, isClaudeDesktop, errorMessage } = opts;

  const title = success ? 'Authentication successful' : 'Authentication failed';

  const icon = success
    ? `<div class="icon success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
      </div>`
    : `<div class="icon error">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>`;

  const heading = success
    ? 'Connected to Google Workspace'
    : 'Authentication failed';

  const body = success
    ? isClaudeDesktop
      ? `<p class="subtitle">Your account is connected. Returning you to Claude&nbsp;Desktop&hellip;</p>
         <p class="countdown">Redirecting in <span id="n">3</span> second<span id="s">s</span></p>`
      : `<p class="subtitle">Your account is connected. You may close this tab.</p>`
    : `<p class="subtitle">${escapeHtml(errorMessage ?? 'An unexpected error occurred.')}</p>
       <p class="hint">Close this tab and try again, or contact support if the problem persists.</p>`;

  const closeButton = success
    ? `<button class="btn" onclick="tryClose()">Close tab</button>`
    : `<button class="btn secondary" onclick="tryClose()">Close tab</button>`;

  // JS runs after DOM ready. On success + Claude Desktop we count down then
  // redirect to claude://.  We always attempt window.close() once the page
  // has loaded (works when the browser tab was opened programmatically).
  const script = success
    ? isClaudeDesktop
      ? `
  let secs = 3;
  const nEl = document.getElementById('n');
  const sEl = document.getElementById('s');
  const timer = setInterval(() => {
    secs--;
    if (nEl) nEl.textContent = String(secs);
    if (sEl) sEl.textContent = secs === 1 ? '' : 's';
    if (secs <= 0) {
      clearInterval(timer);
      window.location.href = 'claude://';
      // Give the OS a moment, then try to close the tab too.
      setTimeout(tryClose, 500);
    }
  }, 1000);
  function tryClose() { window.close(); }
`
      : `function tryClose() { window.close(); }`
    : `function tryClose() { window.close(); }`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%, #f5f0ff 100%);
      color: #1a1a2e;
      padding: 2rem;
    }

    .card {
      background: #fff;
      border-radius: 1.25rem;
      padding: 3rem 2.5rem 2.5rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,.08), 0 1px 4px rgba(0,0,0,.04);
    }

    .icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
    }
    .icon svg { width: 38px; height: 38px; }
    .icon.success { background: #edfaf3; color: #1a8a4a; }
    .icon.error   { background: #fef0f0; color: #c0392b; }

    h1 {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -.01em;
      margin-bottom: .75rem;
    }

    .subtitle {
      font-size: .975rem;
      color: #555;
      line-height: 1.55;
      margin-bottom: .5rem;
    }

    .countdown {
      font-size: .875rem;
      color: #888;
      margin-bottom: 1.75rem;
    }

    .hint {
      font-size: .875rem;
      color: #888;
      margin-top: .5rem;
      margin-bottom: 1.75rem;
    }

    .spacer { height: 1.75rem; }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      padding: .6rem 1.4rem;
      border-radius: .6rem;
      border: none;
      cursor: pointer;
      font-size: .9rem;
      font-weight: 500;
      transition: opacity .15s;
    }
    .btn:hover { opacity: .85; }
    .btn        { background: #4f46e5; color: #fff; }
    .btn.secondary { background: #f3f4f6; color: #333; }

    .wordmark {
      margin-top: 2rem;
      font-size: .75rem;
      color: #bbb;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="card">
    ${icon}
    <h1>${heading}</h1>
    ${body}
    ${success ? '<div class="spacer"></div>' : ''}
    ${closeButton}
    <div class="wordmark">Google Workspace MCP</div>
  </div>
  <script>
    ${script}
  </script>
</body>
</html>
`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
