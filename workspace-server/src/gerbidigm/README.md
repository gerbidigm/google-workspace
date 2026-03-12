# Gerbidigm Custom Tools

This directory contains custom MCP tools that are isolated from upstream changes.

## Architecture

```text
gerbidigm/
├── README.md              # This file
├── register-tools.ts      # Central registration (called from index.ts)
└── services/              # Custom service implementations
    ├── ExampleCustomService.ts
    └── YourCustomService.ts
```

## Minimal Patch Strategy

The **only** change to upstream `index.ts` is a 3-line import and call:

```typescript
// GERBIDIGM PATCH: Register custom tools
const { registerGerbidigmTools } = await import('./gerbidigm/register-tools.js');
await registerGerbidigmTools(server, authManager, { separator, readOnlyToolProps }, { peopleService });
```

The 4th parameter passes upstream service instances for creating wrapper tools.
This keeps merge conflicts minimal when pulling upstream changes.

## Adding New Tools

### 1. Create a Service (optional, can use existing)

Create a new service in `services/`:

```typescript
// services/MyCustomService.ts
export class MyCustomService {
  constructor(private authManager: AuthManager) {}

  public myTool = async ({ param }: { param: string }) => {
    // Your implementation
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ result }) }],
    };
  };
}
```

### 2. Register in `register-tools.ts`

```typescript
export async function registerGerbidigmTools(server, authManager, options) {
  const { separator } = options;

  // Instantiate your service
  const myService = new MyCustomService(authManager);

  // Register the tool
  server.registerTool(
    `gerbidigm${separator}myTool`,
    {
      description: 'My custom tool description',
      inputSchema: {
        param: z.string().describe('Parameter description'),
      },
    },
    myService.myTool,
  );
}
```

### 3. Build and Test

```bash
npm run build
gemini extensions uninstall google-workspace
gemini extensions link .
gemini --debug
```

## Wrapper Tools

Custom tools can **wrap** existing upstream tools to improve discoverability:

```typescript
// Example: searchDirectory wraps people.getUserProfile
if (services?.peopleService) {
  server.registerTool(
    `gerbidigm${separator}searchDirectory`,
    {
      description: 'Search the Google Workspace directory...',
      inputSchema: { query: z.string() },
      ...readOnlyToolProps,
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

## Tool Naming Convention

All custom tools use the `gerbidigm` prefix:

- With dots (Gemini CLI): `gerbidigm.myTool`
- With underscores (Claude Desktop): `gerbidigm_myTool`

This prevents conflicts with upstream tool names.

## License

All files in this directory use the Apache-2.0 license header (ESLint enforced):

```typescript
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
```
