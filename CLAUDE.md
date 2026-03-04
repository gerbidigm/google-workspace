# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Google Workspace MCP (Model Context Protocol) server that integrates Google Docs, Sheets,
Slides, Drive, Calendar, Gmail, Chat, and People into the Gemini CLI. The server exposes
~100+ tools via the MCP protocol over stdio.

## Commands

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run all tests
npm run test

# Run a single test file
npm run test -- workspace-server/src/__tests__/GmailService.test.ts

# Lint (ESLint + Prettier check)
npm run lint

# Fix lint issues
npm run lint:fix

# Format with Prettier
npm run format:fix

# Full pre-commit check (recommended)
npm run test && npm run lint

# TypeScript type checking (no emit)
npx tsc --noEmit --project workspace-server
```

**Node.js version:** Use `~20.19.0` for development (upstream dev dependency constraint).

## Architecture

The main entry point is `workspace-server/src/index.ts`, which:

1. Initializes `AuthManager` with all required OAuth scopes
2. Instantiates each service class (`DocsService`, `DriveService`, etc.)
3. Calls `server.registerTool()` for each tool, with a Zod input schema and a handler
   bound to a service method
4. By default, normalizes tool names from dot notation (`docs.create`) to underscores
   (`docs_create`); the `--use-dot-names` flag preserves dots (used when running as a
   Gemini CLI extension)

**Layers:**

```text
index.ts (MCP server + tool registration)
    └── services/ (Google API business logic, one file per product)
    └── auth/AuthManager.ts (OAuth 2.0, token refresh, secure keychain storage)
    └── utils/ (logging, validation, query builders, MIME helpers)
```

Each service is a class that takes `AuthManager` as a constructor dependency and exposes
async methods that are directly wired to tools in `index.ts`.

## Adding a New Tool

1. Add a method to the relevant service in `workspace-server/src/services/`.
2. In `workspace-server/src/index.ts`, call `server.registerTool()` with:
   - Name in dot notation (e.g., `docs.myTool`)
   - Description for the AI model
   - Zod input schema
   - Handler bound to the service method
3. Mark read-only tools with `readOnlyHint: true` in the tool annotations.

## Key Conventions

- **License headers:** All source files require an Apache 2.0 SPDX header. ESLint enforces
  the exact format with years `2025`–`2026`.
- **Imports:** Use `node:` protocol for built-in modules (ESLint enforced). No relative
  imports across packages.
- **Tool names:** Source uses dot notation; runtime normalizes to underscores unless
  `--use-dot-names` is passed.
- **Test location:** `workspace-server/src/__tests__/`; coverage thresholds are 45%
  branches / 65% functions / 60% lines.
- **Module alias:** `@/` resolves to `workspace-server/src/` in Jest.

## Authentication

```bash
node scripts/auth-utils.js login    # OAuth login (headless-safe)
node scripts/auth-utils.js clear    # Clear stored credentials
node scripts/auth-utils.js expire   # Force token expiration (testing)
node scripts/auth-utils.js status   # Show auth status
```

In headless environments (SSH/WSL/Cloud Shell), `login` reads credentials from `/dev/tty`
so they are never exposed to the AI model that spawned the process.

## Testing with Gemini CLI

```bash
gemini extensions uninstall google-workspace
npm install && npm run build
gemini extensions link .
gemini --debug
```
