# Testing Gerbidigm Gmail Flexible Fetch Tools

This guide walks through testing the new flexible Gmail fetch tools using Claude
Desktop or Claude CLI.

## Prerequisites

### 1. Build the Project

```bash
npm run build
```

### 2. Configure Claude Desktop

The MCP server should already be configured in
`~/Library/Application Support/Claude/claude_desktop_config.json`:

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

**Note:** Update the path to match your local installation if different.

### 3. Authenticate with Google

If not already authenticated:

```bash
node scripts/auth-utils.js login
```

Or use the standard OAuth flow when the server first requests access.

### 4. Restart Claude Desktop

After building, restart Claude Desktop to load the new tools:

- Quit Claude Desktop completely (Cmd+Q)
- Reopen Claude Desktop

## Tool Names

In Claude Desktop (using underscores):

- `gerbidigm_gmail_fetchFlexible`
- `gerbidigm_gmail_batchFetchFlexible`

In Gemini CLI (using dots):

- `gerbidigm.gmail.fetchFlexible`
- `gerbidigm.gmail.batchFetchFlexible`

## Test Scenarios

### Test 1: Verify Tools Are Available

**Prompt:**

```
What gerbidigm Gmail tools are available?
```

**Expected:** Claude should list the two new tools with their descriptions.

---

### Test 2: Fetch Metadata Only

**Scenario:** Get sender, subject, and date without fetching the full email
body.

**Prompt:**

```
Use gerbidigm_gmail_fetchFlexible to fetch message ID <YOUR_MESSAGE_ID>
with format "metadata" and metadataHeaders ["From", "Subject", "Date"]
```

**Replace** `<YOUR_MESSAGE_ID>` with an actual Gmail message ID from your inbox.

**To get a message ID first, run:**

```
Search my Gmail for recent emails and show me a few message IDs
```

**Expected Output:**

- JSON with id, threadId, payload with only requested headers
- No body content
- Fast response

**Verify:**

- Response is smaller than a full fetch
- Only requested headers are present

---

### Test 3: Minimal Format with Field Mask

**Scenario:** Get just the ID and labels of a message (fastest possible fetch).

**Prompt:**

```
Use gerbidigm_gmail_fetchFlexible to fetch message <MESSAGE_ID>
with format "minimal" and fields "id,labelIds"
```

**Expected Output:**

```json
{
  "id": "...",
  "labelIds": ["INBOX", "UNREAD", ...]
}
```

**Verify:**

- Response contains only id and labelIds
- Very fast response time

---

### Test 4: Full Message Fetch

**Scenario:** Get complete email including body and attachments.

**Prompt:**

```
Use gerbidigm_gmail_fetchFlexible to fetch message <MESSAGE_ID>
with format "full"
```

**Expected Output:**

- Complete message structure
- Headers in payload
- Body parts
- Attachment metadata (if any)

**Verify:**

- Full email content is present
- Can read the email body
- Attachment info included (if email has attachments)

---

### Test 5: Batch Fetch Multiple Messages

**Scenario:** Get metadata for multiple emails efficiently.

**First, get some message IDs:**

```
Search Gmail for recent emails (last 5) and give me their message IDs
```

**Then use batch fetch:**

```
Use gerbidigm_gmail_batchFetchFlexible to fetch these message IDs:
[<ID1>, <ID2>, <ID3>]
with format "metadata" and metadataHeaders ["From", "Subject", "Date"]
```

**Expected Output:**

```json
{
  "summary": {
    "total": 3,
    "successful": 3,
    "failed": 0
  },
  "messages": [
    {
      /* message 1 data */
    },
    {
      /* message 2 data */
    },
    {
      /* message 3 data */
    }
  ]
}
```

**Verify:**

- All messages fetched in one call
- Summary shows correct counts
- Messages array has all data

---

### Test 6: Field Mask Optimization

**Scenario:** Fetch multiple messages but only need snippet and labels.

**Prompt:**

```
Use gerbidigm_gmail_batchFetchFlexible with these IDs: [<ID1>, <ID2>]
format "metadata", and fields "id,threadId,snippet,labelIds"
```

**Expected Output:**

- Each message has only: id, threadId, snippet, labelIds
- No payload or other fields

**Verify:**

- Response is much smaller than full fetch
- Only specified fields present

---

### Test 7: Error Handling - Invalid Message ID

**Scenario:** Try to fetch a non-existent message.

**Prompt:**

```
Use gerbidigm_gmail_fetchFlexible to fetch message "INVALID_MESSAGE_ID"
with format "metadata"
```

**Expected Output:**

```json
{
  "error": "Requested entity was not found."
}
```

**Verify:**

- Error is returned gracefully
- Error message is clear

---

### Test 8: Batch Fetch with Some Failures

**Scenario:** Batch fetch with mix of valid and invalid IDs.

**Prompt:**

```
Use gerbidigm_gmail_batchFetchFlexible with messageIds:
["VALID_ID", "INVALID_ID", "ANOTHER_VALID_ID"]
format "minimal"
```

**Expected Output:**

```json
{
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 1
  },
  "messages": [
    /* valid messages */
  ],
  "errors": [
    {
      "messageId": "INVALID_ID",
      "success": false,
      "error": "..."
    }
  ]
}
```

**Verify:**

- Successful messages are returned
- Failed messages are listed in errors
- Summary counts are correct

---

### Test 9: Compare with Standard gmail_get

**Scenario:** Compare performance and output size.

**First, use standard tool:**

```
Use gmail_get to fetch message <MESSAGE_ID> with format "full"
```

**Then, use flexible tool with field mask:**

```
Use gerbidigm_gmail_fetchFlexible to fetch the same message
with format "full" and fields "id,threadId,snippet,payload/headers"
```

**Compare:**

- Response size (flexible should be smaller)
- Speed (flexible should be faster)
- Data returned (flexible has only requested fields)

---

### Test 10: Real-World Scenario - Email Triage

**Scenario:** Build an email summary dashboard.

**Prompt:**

```
Help me triage my inbox:
1. Search for unread emails
2. Use gerbidigm_gmail_batchFetchFlexible to get From, Subject, and Date
   for the first 10
3. Summarize them in a table
```

**Expected:** Claude should:

1. Search Gmail with `is:unread`
2. Extract message IDs
3. Batch fetch with metadata format
4. Create a formatted summary table

**Verify:**

- Process is efficient (one batch fetch)
- Table shows key info
- Faster than fetching full emails

---

## Performance Benchmarks

For reference, here are expected performance characteristics:

| Operation        | Format   | Field Mask       | Approx Response Size |
| ---------------- | -------- | ---------------- | -------------------- |
| Single fetch     | minimal  | id,labelIds      | ~200 bytes           |
| Single fetch     | metadata | default          | ~5-10 KB             |
| Single fetch     | metadata | specific headers | ~2-5 KB              |
| Single fetch     | full     | none             | ~50-500 KB+          |
| Single fetch     | full     | headers only     | ~10-20 KB            |
| Batch fetch (10) | metadata | specific headers | ~20-50 KB            |

**Note:** Actual sizes vary based on email content, number of headers, etc.

## Troubleshooting

### Tools Not Appearing

1. **Verify build:** `npm run build` completed successfully
2. **Check server is running:** Look for "Registered X Gerbidigm custom tools"
   in logs
3. **Restart Claude Desktop:** Fully quit and reopen
4. **Check config:** Verify path in `claude_desktop_config.json`

### Authentication Issues

```bash
# Check auth status
node scripts/auth-utils.js status

# Re-authenticate if needed
node scripts/auth-utils.js login
```

### Server Not Starting

**Check logs:**

```bash
# On macOS, Claude Desktop logs are in:
tail -f ~/Library/Logs/Claude/mcp*.log
```

**Common issues:**

- Node version mismatch (need Node 20)
- Missing dependencies (run `npm install`)
- Path to dist/index.js incorrect

### Tools Return Errors

**"Invalid credentials"**

- Run `node scripts/auth-utils.js login` to re-authenticate

**"Tool not found"**

- Verify tool name matches your client (underscores for Claude, dots for Gemini)
- Rebuild the project

**"Invalid field mask"**

- Check field mask syntax (no spaces, use slashes for nesting)
- Example: `"id,threadId,payload/headers"`

## Debugging Tips

### Enable Debug Logging

Start the MCP server with debug flag:

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

### Check Server Output

The server logs to stderr, which Claude Desktop captures. You can also run it
manually:

```bash
node workspace-server/dist/index.js --debug
```

Then interact via JSON-RPC over stdio (advanced).

### Verify Tool Registration

Look for this in the server output:

```
Registered 4 Gerbidigm custom tools.
```

(5 tools if peopleService wrapper is enabled)

## Next Steps

After verifying the tools work:

1. **Write unit tests:** Add Jest tests for FlexibleGmailService
2. **Integration tests:** Test against Gmail API test environment
3. **Documentation:** Update CLAUDE.md with new tool examples
4. **Performance testing:** Measure actual response times and sizes

## Advanced Testing

### Load Testing

Test batch fetch with maximum message count:

```
Use gerbidigm_gmail_batchFetchFlexible with 100 message IDs
```

### Edge Cases

- Very large emails (10+ MB)
- Emails with many attachments (20+)
- Emails with special characters in headers
- Threads with 50+ messages

### Field Mask Variations

Test different field mask patterns:

- `"*"` (all fields)
- `"payload/*"` (all payload fields)
- `"id,threadId,payload(headers,body)"` (nested selection)

See
[Gmail API partial response docs](https://developers.google.com/gmail/api/guides/performance#partial-response)
for advanced syntax.

## Feedback

If you encounter issues or have suggestions:

1. Check troubleshooting section above
2. Review server logs for errors
3. Verify your test scenario matches the examples
4. Consider opening an issue with reproduction steps
