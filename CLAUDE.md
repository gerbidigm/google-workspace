# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

Google Workspace MCP (Model Context Protocol) server that integrates Google
Docs, Sheets, Slides, Drive, Calendar, Gmail, Chat, and People into the Gemini
CLI. The server exposes ~100+ tools via the MCP protocol over stdio.

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

**Node.js version:** Use `~20.19.0` for development (upstream dev dependency
constraint).

## Architecture

The main entry point is `workspace-server/src/index.ts`, which:

1. Initializes `AuthManager` with all required OAuth scopes
2. Instantiates each service class (`DocsService`, `DriveService`, etc.)
3. Calls `server.registerTool()` for each tool, with a Zod input schema and a
   handler bound to a service method
4. By default, normalizes tool names from dot notation (`docs.create`) to
   underscores (`docs_create`); the `--use-dot-names` flag preserves dots (used
   when running as a Gemini CLI extension)

**Layers:**

```text
index.ts (MCP server + tool registration)
    └── services/ (Google API business logic, one file per product)
    └── auth/AuthManager.ts (OAuth 2.0, token refresh, secure keychain storage)
    └── utils/ (logging, validation, query builders, MIME helpers)
```

Each service is a class that takes `AuthManager` as a constructor dependency and
exposes async methods that are directly wired to tools in `index.ts`.

## Adding a New Tool

1. Add a method to the relevant service in `workspace-server/src/services/`.
2. In `workspace-server/src/index.ts`, call `server.registerTool()` with:
   - Name in dot notation (e.g., `docs.myTool`)
   - Description for the AI model
   - Zod input schema
   - Handler bound to the service method
3. Mark read-only tools with `readOnlyHint: true` in the tool annotations.

## Key Conventions

- **License headers:** All source files require an Apache 2.0 SPDX header.
  ESLint enforces the exact format with years `2025`–`2026`.
- **Imports:** Use `node:` protocol for built-in modules (ESLint enforced). No
  relative imports across packages.
- **Tool names:** Source uses dot notation; runtime normalizes to underscores
  unless `--use-dot-names` is passed.
- **Test location:** `workspace-server/src/__tests__/`; coverage thresholds are
  45% branches / 65% functions / 60% lines.
- **Module alias:** `@/` resolves to `workspace-server/src/` in Jest.

## Authentication

```bash
node scripts/auth-utils.js login    # OAuth login (headless-safe)
node scripts/auth-utils.js clear    # Clear stored credentials
node scripts/auth-utils.js expire   # Force token expiration (testing)
node scripts/auth-utils.js status   # Show auth status
```

In headless environments (SSH/WSL/Cloud Shell), `login` reads credentials from
`/dev/tty` so they are never exposed to the AI model that spawned the process.

## Testing with Gemini CLI

```bash
gemini extensions uninstall google-workspace
npm install && npm run build
gemini extensions link .
gemini --debug
```

## Custom Tools (Gerbidigm)

To minimize merge conflicts with upstream, custom tools are isolated in a dedicated
namespace with a **minimal 3-line patch** to `index.ts`.

### Custom Tools Architecture

```text
workspace-server/src/
├── gerbidigm/                          # Custom code (isolated from upstream)
│   ├── README.md                       # Complete usage guide
│   ├── INDEX_PATCH.md                  # Patch documentation
│   ├── register-tools.ts               # Central registration function
│   └── services/                       # Custom service implementations
│       └── ExampleCustomService.ts     # Example service
└── index.ts                            # 3-line patch only
```

### The Patch

Only **3 lines** in `index.ts` (before `server.connect()`):

```typescript
// GERBIDIGM PATCH: Register custom tools
const { registerGerbidigmTools } = await import('./gerbidigm/register-tools.js');
await registerGerbidigmTools(server, authManager, { separator, readOnlyToolProps }, { peopleService });
```

The services object passes upstream service instances for creating wrapper tools.

### Adding New Custom Tools

1. Create a service in `workspace-server/src/gerbidigm/services/`:

   ```typescript
   export class MyCustomService {
     constructor(private authManager: AuthManager) {}
     public myTool = async (params) => { /* implementation */ };
   }
   ```

2. Register in `workspace-server/src/gerbidigm/register-tools.ts`:

   ```typescript
   const myService = new MyCustomService(authManager);
   server.registerTool(`gerbidigm${separator}myTool`, {...}, myService.myTool);
   ```

3. Build: `npm run build`

All custom tools use the `gerbidigm` prefix (e.g., `gerbidigm_echo`,
`gerbidigm.myTool`) to avoid naming conflicts with upstream tools.

**Note:** Custom tool files must use the standard Apache 2.0 license header
(`Copyright 2025 Google LLC`) enforced by ESLint.

### Wrapper Tools Pattern

Custom tools can **wrap** existing upstream tools to improve discoverability:

```typescript
// Example: searchDirectory wraps people.getUserProfile
if (services?.peopleService) {
  server.registerTool(
    `gerbidigm${separator}searchDirectory`,
    {
      description: 'Search the Google Workspace directory for users by name...',
      inputSchema: { query: z.string() }
    },
    async ({ query }) => services.peopleService!.getUserProfile({ name: query })
  );
}
```

**When to create wrappers:**

- Upstream tool has hidden/unclear capabilities
- Generic tool name doesn't indicate specific use case
- Simplify complex multi-parameter tools for common scenarios
- Improve AI agent tool selection with targeted descriptions

**Benefits:**

- Zero code duplication (reuses upstream implementation)
- Better tool discovery for AI agents
- No upstream patches needed

### Benefits

- **Minimal conflicts**: Only 3 lines to maintain during upstream merges
- **Complete isolation**: All custom code in `gerbidigm/` namespace
- **Clear markers**: `GERBIDIGM PATCH START/END` comments in `index.ts`
- **Easy testing**: Custom tools can be tested independently
- **Wrapper support**: Can enhance upstream tools without modifying them
