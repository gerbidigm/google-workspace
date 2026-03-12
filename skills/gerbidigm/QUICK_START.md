# Quick Start: Testing Flexible Gmail Tools with Claude

## 1. Build the Project

```bash
npm run build
```

## 2. Verify Tools Are Registered

```bash
node scripts/verify-tools.js
```

You should see:

```
✅ Gerbidigm tools registered: 5
✅ All checks passed!
```

## 3. Restart Claude Desktop

- Quit Claude Desktop completely (Cmd+Q on Mac)
- Reopen Claude Desktop

## 4. Test in Claude Desktop

Open a new conversation and try:

```
What gerbidigm Gmail tools are available?
```

Claude should list:

- `gerbidigm_gmail_fetchFlexible`
- `gerbidigm_gmail_batchFetchFlexible`

## 5. Run Your First Test

Get a message ID first:

```
Search my Gmail for recent emails and show me 5 message IDs.
```

Then test the flexible fetch:

```
Use gerbidigm_gmail_fetchFlexible to fetch message <MESSAGE_ID> with:
- format: "metadata"
- metadataHeaders: ["From", "Subject", "Date"]

Show me just the From, Subject, and Date.
```

## Next Steps

### For More Test Scenarios

📖 See [TEST_PROMPTS.md](TEST_PROMPTS.md) - Copy-paste test prompts

📖 See [TESTING.md](TESTING.md) - Detailed testing guide with 10 scenarios

### For Usage Guidance

📖 See [gmail-fetch.md](gmail-fetch.md) - Complete skill documentation with:

- Format options explained
- Field mask patterns
- Real-world examples
- Performance tips
- Best practices

## Troubleshooting

**Tools not showing up?**

1. Run `npm run build`
2. Run `node scripts/verify-tools.js`
3. Completely quit and reopen Claude Desktop
4. Check `~/Library/Application Support/Claude/claude_desktop_config.json` has correct path

**Authentication errors?**

```bash
node scripts/auth-utils.js status    # Check auth status
node scripts/auth-utils.js login     # Re-authenticate if needed
```

**Need help?**

- Check [TESTING.md](TESTING.md) troubleshooting section
- Review server logs
- Verify the build completed successfully

## What You Get

✅ **Fine-grained control** - Fetch only the data you need

✅ **Performance optimization** - Reduce bandwidth with field masks

✅ **Batch operations** - Process up to 100 messages efficiently

✅ **Format flexibility** - Choose minimal, metadata, full, or raw

✅ **Smart defaults** - Sensible options for common use cases

## Configuration

The MCP server config in `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": [
        "/Users/charlie/github/gerbidigm/workspace/workspace-server/dist/index.js"
      ]
    }
  }
}
```

Optional debug mode:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "node",
      "args": [
        "/Users/charlie/github/gerbidigm/workspace/workspace-server/dist/index.js",
        "--debug"
      ]
    }
  }
}
```

## Happy Testing! 🚀
