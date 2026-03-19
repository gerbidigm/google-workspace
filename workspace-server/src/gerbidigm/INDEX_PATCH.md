# Patch for index.ts

This is the **only** change needed in `workspace-server/src/index.ts`.

## Location

Add these 3 lines after all upstream tool registrations, right before the server
connects to the transport (around line 1373, just before the comment
`// 4. Connect the transport layer...`).

## The Patch

```typescript
  // ... (existing upstream tool registrations above)

  peopleService.getUserRelations,
);

// GERBIDIGM PATCH START
const { registerGerbidigmTools } = await import('./gerbidigm/register-tools.js');
await registerGerbidigmTools(server, authManager, { separator, readOnlyToolProps }, { peopleService });
// GERBIDIGM PATCH END

// 4. Connect the transport layer and start listening
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Services Parameter

The 4th parameter passes upstream service instances for creating wrapper tools:

```typescript
{
  peopleService;
} // Currently passed
```

To add more services, update this object:

```typescript
{
  (peopleService, driveService, gmailService);
}
```

This allows custom tools to wrap/leverage existing implementations without
duplication.

## Why This Works

1. **Minimal surface area**: Only 3 lines to maintain during merges
2. **Clear markers**: `GERBIDIGM PATCH START/END` comments make it obvious
3. **Dynamic import**: Uses ESM `import()` so TypeScript compilation is happy
4. **All dependencies passed**: `server`, `authManager`, and options are
   provided
5. **Before connection**: Tools must be registered before `server.connect()`

## Merge Strategy

When pulling upstream changes:

1. If `index.ts` has conflicts, the patch is clearly marked
2. Simply move the 3-line patch to the new location (before `server.connect()`)
3. All custom tool logic remains untouched in `./gerbidigm/`
