# Testing the Google Workspace + Gerbidigm Plugin

Quick testing guide for the Claude Code plugin installation.

## Installation Test

### 1. Install the Plugin

```bash
# From the workspace directory
npm run build
claude plugins install ./claude-plugin
```

### 2. Verify Installation

```bash
claude plugins list
```

You should see:
```
google-workspace-gerbidigm  v0.1.0
```

### 3. Check Server Connection

Start Claude Code:
```bash
claude
```

Check MCP status:
```
/mcp
```

Expected output:
- `google-workspace` server listed
- Status: **connected**

## Quick Feature Tests

### Test 1: List Available Tools

```
What gerbidigm tools are available?
```

**Expected:** Should list 5 gerbidigm tools:
- `gerbidigm_gmail_fetchFlexible`
- `gerbidigm_gmail_batchFetchFlexible`
- `gerbidigm_searchDirectory`
- `gerbidigm_echo`
- `gerbidigm_anotherTool`

### Test 2: Basic Gmail Search

```
Search my Gmail for recent emails from the last 24 hours
```

**Expected:** List of recent email message IDs

### Test 3: Flexible Gmail Fetch

First get a message ID from Test 2, then:

```
Use gerbidigm_gmail_fetchFlexible to fetch message <MESSAGE_ID> with:
- format: "metadata"
- metadataHeaders: ["From", "Subject", "Date"]

Show me the From, Subject, and Date
```

**Expected:** Quickly returns just the requested headers

### Test 4: Batch Fetch

```
Search Gmail for 5 recent emails. Then use gerbidigm_gmail_batchFetchFlexible
to fetch their metadata with format "metadata" and
metadataHeaders ["From", "Subject"]

Create a table of the results
```

**Expected:** Table with From and Subject columns for 5 emails

### Test 5: Standard Google Workspace Tools

Test non-Gerbidigm tools work:

```
What's on my calendar today?
```

```
Search my Google Drive for files modified in the last week
```

## Performance Test

Compare standard vs. flexible fetch:

```
Let's compare performance:

1. Use gmail_get to fetch message <MESSAGE_ID> with format "full"
2. Use gerbidigm_gmail_fetchFlexible to fetch the same message with
   format "full" and fields "id,snippet,payload/headers"

Which was faster and returned less data?
```

**Expected:** Flexible fetch should be faster with smaller response

## Comprehensive Test Prompts

For more detailed testing, see:
- [skills/gerbidigm/TEST_PROMPTS.md](skills/gerbidigm/TEST_PROMPTS.md) - Copy-paste prompts
- [skills/gerbidigm/TESTING.md](skills/gerbidigm/TESTING.md) - 10 detailed scenarios

## Troubleshooting

### Plugin Not Loading

**Check installation:**
```bash
claude plugins list
claude plugins get google-workspace-gerbidigm
```

**Reinstall:**
```bash
claude plugins remove google-workspace-gerbidigm
cd /path/to/workspace
npm run build
claude plugins install ./claude-plugin
```

### Server Not Connected

**Check MCP status:**
```
/mcp
```

If `google-workspace` shows as disconnected:

1. **Verify build:**
   ```bash
   npm run build
   node scripts/verify-tools.js
   ```

2. **Check authentication:**
   ```bash
   node scripts/auth-utils.js status
   node scripts/auth-utils.js login  # if needed
   ```

3. **Check plugin path:**
   ```bash
   claude plugins get google-workspace-gerbidigm
   ```

   Verify the path to `index.js` is correct.

4. **Restart Claude Code:**
   ```bash
   exit
   claude
   ```

### Authentication Issues

**Re-authenticate:**
```bash
node scripts/auth-utils.js login
```

**Check status:**
```bash
node scripts/auth-utils.js status
```

### Tools Not Appearing

1. **Rebuild the server:**
   ```bash
   npm run build
   ```

2. **Verify registration:**
   ```bash
   node scripts/verify-tools.js
   ```

   Should show: "✅ Gerbidigm tools registered: 5"

3. **Check server logs:**

   In Claude Code, the MCP server logs to stderr. Enable debug mode:

   Edit `claude-plugin/.mcp.json`:
   ```json
   {
     "google-workspace": {
       "command": "node",
       "args": [
         "${CLAUDE_PLUGIN_ROOT}/../workspace-server/dist/index.js",
         "--debug"
       ]
     }
   }
   ```

   Then reinstall the plugin.

### Path Issues

The plugin uses `${CLAUDE_PLUGIN_ROOT}` to reference files. If you see path errors:

1. Check the plugin is installed (not just symlinked)
2. Ensure the workspace directory structure is intact
3. Verify `workspace-server/dist/index.js` exists

## Test Success Criteria

✅ Plugin appears in `claude plugins list`
✅ MCP server shows as "connected" in `/mcp`
✅ All 5 gerbidigm tools are listed
✅ Can search Gmail successfully
✅ Flexible fetch tools work with different formats
✅ Batch fetch processes multiple messages
✅ Standard Google Workspace tools (calendar, drive) work

## Next Steps

Once basic tests pass:

1. **Explore skills** - See [skills/gerbidigm/](skills/gerbidigm/) for detailed guides
2. **Test scenarios** - Try all 10 scenarios in [TESTING.md](skills/gerbidigm/TESTING.md)
3. **Real workflows** - Use for actual email triage, document management, etc.

## Getting Help

- **Verification script:** `node scripts/verify-tools.js`
- **Authentication utils:** `node scripts/auth-utils.js --help`
- **Documentation:** See `docs/` directory
- **Issues:** https://github.com/gerbidigm/workspace/issues
