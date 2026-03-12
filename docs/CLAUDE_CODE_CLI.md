# Using Google Workspace MCP with Claude Code CLI

This guide explains how to use the Google Workspace MCP server (including Gerbidigm custom tools) with Claude Code CLI.

## Quick Setup

### Option 1: Project-Scoped (Recommended for this repo)

Add the server to this project only:

```bash
cd /Users/charlie/github/gerbidigm/workspace
claude mcp add --transport stdio --scope project google-workspace -- \
  node workspace-server/dist/index.js
```

This creates a `.mcp.json` file in the project root that's shared with anyone using the repository.

### Option 2: User-Scoped

Add the server globally for all your projects:

```bash
claude mcp add --transport stdio google-workspace -- \
  node /Users/charlie/github/gerbidigm/workspace/workspace-server/dist/index.js
```

### Option 3: Manual Configuration

Create `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "google-workspace": {
      "type": "stdio",
      "command": "node",
      "args": [
        "workspace-server/dist/index.js"
      ]
    }
  }
}
```

Or for absolute paths (user-scoped in `~/.claude.json`):

```json
{
  "mcpServers": {
    "google-workspace": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/Users/charlie/github/gerbidigm/workspace/workspace-server/dist/index.js"
      ]
    }
  }
}
```

## With Debug Logging

Add `--debug` flag for troubleshooting:

```bash
claude mcp add --transport stdio --scope project google-workspace -- \
  node workspace-server/dist/index.js --debug
```

Or in `.mcp.json`:

```json
{
  "mcpServers": {
    "google-workspace": {
      "type": "stdio",
      "command": "node",
      "args": [
        "workspace-server/dist/index.js",
        "--debug"
      ]
    }
  }
}
```

## Prerequisites

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Authenticate with Google:**
   ```bash
   node scripts/auth-utils.js login
   ```

3. **Verify tools are registered:**
   ```bash
   node scripts/verify-tools.js
   ```

## Using in Claude Code CLI

Once configured, start Claude Code CLI:

```bash
claude
```

Or in a specific project:

```bash
cd /Users/charlie/github/gerbidigm/workspace
claude
```

### Check MCP Status

In Claude Code CLI, use:

```
/mcp
```

This shows all configured MCP servers and their status.

### Test Gerbidigm Tools

```
What gerbidigm tools are available?
```

You should see:
- `gerbidigm_echo`
- `gerbidigm_anotherTool`
- `gerbidigm_gmail_fetchFlexible`
- `gerbidigm_gmail_batchFetchFlexible`
- `gerbidigm_searchDirectory` (if peopleService is available)

### Quick Test

```
Search my Gmail for recent emails and show me 5 message IDs.
Then use gerbidigm_gmail_fetchFlexible to fetch one with format "metadata"
and metadataHeaders ["From", "Subject", "Date"]
```

## Management Commands

### List all MCP servers

```bash
claude mcp list
```

### Get details for specific server

```bash
claude mcp get google-workspace
```

### Remove server

```bash
claude mcp remove google-workspace
```

## Configuration Scopes

Claude Code CLI supports three scopes for MCP servers:

| Scope | Location | Use Case |
|-------|----------|----------|
| **Local** | `~/.claude.json` | Personal, project-specific (default) |
| **Project** | `.mcp.json` | Team-shared, checked into git |
| **User** | `~/.claude.json` | Personal, all projects |

### Choosing a Scope

**For this Google Workspace MCP server:**

- **Project scope** (`.mcp.json`) - Best if your team uses Claude Code CLI
- **User scope** (`~/.claude.json`) - Best for personal use across projects
- **Local scope** - Best for testing or temporary configurations

## Tool Name Format

In Claude Code CLI, tools use **underscore** notation (not dots):

- `gerbidigm_gmail_fetchFlexible` ✅
- `gmail_get` ✅
- `docs_create` ✅

Not:
- `gerbidigm.gmail.fetchFlexible` ❌ (Gemini CLI format)

## Troubleshooting

### Server Not Found

**Error:** "MCP server 'google-workspace' not found"

**Solution:**
1. Check configuration: `claude mcp list`
2. Verify path in `.mcp.json` or `~/.claude.json`
3. Ensure server is built: `npm run build`

### Authentication Errors

**Error:** "Invalid credentials" or "Not authenticated"

**Solution:**
```bash
node scripts/auth-utils.js status
node scripts/auth-utils.js login  # if needed
```

### Server Not Starting

**Check server can run manually:**
```bash
node workspace-server/dist/index.js --debug
```

**Common issues:**
- Node version mismatch (need Node 20)
- Missing dependencies: `npm install`
- Path incorrect in configuration

### Tools Not Appearing

1. Verify server is connected: `/mcp` in Claude Code CLI
2. Check server is running (should show "connected")
3. Restart Claude Code CLI: `Ctrl+D` then `claude` again
4. Rebuild: `npm run build`

### Debug Logging

Enable debug mode to see detailed logs:

```json
{
  "mcpServers": {
    "google-workspace": {
      "type": "stdio",
      "command": "node",
      "args": [
        "workspace-server/dist/index.js",
        "--debug"
      ]
    }
  }
}
```

## Testing with Claude Code CLI

### Basic Test Prompts

See [skills/gerbidigm/TEST_PROMPTS.md](../skills/gerbidigm/TEST_PROMPTS.md) for copy-paste test prompts.

### Test Scenarios

See [skills/gerbidigm/TESTING.md](../skills/gerbidigm/TESTING.md) for 10 detailed test scenarios.

### Quick Validation

1. **Check tools are available:**
   ```
   What MCP tools start with "gerbidigm_gmail"?
   ```

2. **Test metadata fetch:**
   ```
   Search Gmail for recent emails, get 5 IDs, then use
   gerbidigm_gmail_fetchFlexible to fetch one with format "metadata"
   ```

3. **Test batch fetch:**
   ```
   Search Gmail for 5 recent emails, then use
   gerbidigm_gmail_batchFetchFlexible to get their metadata efficiently
   ```

## Differences from Claude Desktop

| Feature | Claude Desktop | Claude Code CLI |
|---------|----------------|-----------------|
| Config file | `~/Library/Application Support/Claude/claude_desktop_config.json` | `.mcp.json` or `~/.claude.json` |
| Tool names | `gerbidigm_gmail_fetchFlexible` | Same (underscores) |
| Restart needed | Yes (Cmd+Q, reopen) | No (reconnects automatically) |
| Configuration | Manual JSON editing | `claude mcp add` command |
| Scope support | Global only | Local, Project, User |

## Project-Scoped Configuration Example

If you want to commit the MCP configuration to git for team sharing:

**`.mcp.json`:**
```json
{
  "mcpServers": {
    "google-workspace": {
      "type": "stdio",
      "command": "node",
      "args": [
        "workspace-server/dist/index.js"
      ]
    }
  }
}
```

**`.gitignore`:**
```
# Don't commit local MCP overrides
~/.claude.json
```

Then team members can:
```bash
git clone <repo>
cd workspace
npm install
npm run build
node scripts/auth-utils.js login
claude  # MCP server auto-configured from .mcp.json
```

## Benefits of Using Claude Code CLI

✅ **Version control** - `.mcp.json` can be committed to git
✅ **Team sharing** - Everyone uses the same configuration
✅ **Simpler setup** - `claude mcp add` command
✅ **Scope control** - Local, project, or user-level
✅ **No restart needed** - Reconnects automatically
✅ **Built-in management** - `claude mcp list/get/remove`

## Next Steps

1. **Configure the server** using one of the options above
2. **Test basic functionality** with `/mcp` command
3. **Run test prompts** from [TEST_PROMPTS.md](../skills/gerbidigm/TEST_PROMPTS.md)
4. **Review skill guide** at [gmail-fetch.md](../skills/gerbidigm/gmail-fetch.md)

## Additional Resources

- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp.md)
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Google Workspace MCP README](../README.md)
- [Gerbidigm Skills](../skills/gerbidigm/README.md)
