# Quick Setup for Claude Code CLI

This is a quick reference for using the flexible Gmail tools with Claude Code
CLI.

## One-Time Setup

The project is already configured! Just:

### 1. Build the Server

```bash
npm run build
```

### 2. Authenticate

```bash
node scripts/auth-utils.js login
```

### 3. Start Claude Code CLI

```bash
claude
```

That's it! The `.mcp.json` file in the project root automatically configures the
Google Workspace MCP server.

## Verify It's Working

In Claude Code CLI:

```
/mcp
```

You should see:

- `google-workspace` server listed
- Status: connected

## Test the Tools

```
What gerbidigm tools are available?
```

Expected tools:

- `gerbidigm_gmail_fetchFlexible`
- `gerbidigm_gmail_batchFetchFlexible`
- `gerbidigm_echo`
- `gerbidigm_anotherTool`
- `gerbidigm_searchDirectory`

## Quick Test

```
Search my Gmail for 5 recent emails and get their message IDs.
Then use gerbidigm_gmail_fetchFlexible to fetch one with format "metadata"
and metadataHeaders ["From", "Subject", "Date"]
```

## What Was Configured

The `.mcp.json` file at the project root contains:

```json
{
  "mcpServers": {
    "google-workspace": {
      "type": "stdio",
      "command": "node",
      "args": ["workspace-server/dist/index.js"]
    }
  }
}
```

This is **project-scoped** and committed to git, so everyone using the repo gets
the same configuration.

## More Information

- **Full guide:** [docs/CLAUDE_CODE_CLI.md](../../docs/CLAUDE_CODE_CLI.md)
- **Test prompts:** [TEST_PROMPTS.md](TEST_PROMPTS.md)
- **Testing guide:** [TESTING.md](TESTING.md)
- **Skill documentation:** [gmail-fetch.md](gmail-fetch.md)

## Troubleshooting

**Server not connected?**

1. Run `npm run build`
2. Check `/mcp` status in Claude Code CLI
3. Restart: `Ctrl+D` then `claude` again

**Authentication errors?**

```bash
node scripts/auth-utils.js status
node scripts/auth-utils.js login  # if needed
```

**Tools not showing?**

```bash
node scripts/verify-tools.js  # Verify registration
```

## Differences from Claude Desktop

With Claude Code CLI:

- ✅ Configuration is simpler (already done!)
- ✅ No need to edit system-wide config files
- ✅ No need to restart the app
- ✅ Project-scoped configuration
- ✅ Shared with team via git

Just `claude` and you're ready! 🚀
