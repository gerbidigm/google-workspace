# Gmail Flexible Fetch Skill

This skill provides guidance for using the `gerbidigm_gmail_fetchFlexible` and `gerbidigm_gmail_batchFetchFlexible` tools effectively.

## Overview

The flexible Gmail fetch tools give you fine-grained control over what data you retrieve from Gmail messages. Instead of always fetching complete messages, you can:

- Choose specific formats (minimal, metadata, full, raw)
- Use field masks to retrieve only the data you need
- Batch fetch multiple messages efficiently
- Reduce bandwidth and processing time

## When to Use These Tools

### Use `gerbidigm_gmail_fetchFlexible` when:

- You need specific fields from a single email
- You want to optimize performance for a single message
- You need headers without the full body
- You're working with large emails and only need metadata

### Use `gerbidigm_gmail_batchFetchFlexible` when:

- Fetching multiple messages (up to 100)
- Processing search results efficiently
- You need the same fields from many messages
- Building summaries or indexes of multiple emails

## Format Options

### `minimal`
**What you get:** Just `id` and `threadId`
**Use when:** You only need message identifiers (e.g., for further operations)

### `metadata`
**What you get:** Headers only, no body content
**Use when:** You need sender, subject, date, etc. but not the email body
**Best practice:** Specify `metadataHeaders` to limit which headers are returned

Example:
```json
{
  "messageId": "abc123",
  "format": "metadata",
  "metadataHeaders": ["From", "To", "Subject", "Date"]
}
```

### `full`
**What you get:** Complete message including body, attachments, headers
**Use when:** You need to read or process the email content
**Note:** This is the default format but can be slow for large emails

### `raw`
**What you get:** RFC 2822 formatted raw email message
**Use when:** You need the original MIME message for parsing or forwarding

## Field Masks (Advanced)

Field masks let you specify exactly which fields to return, reducing response size and processing time.

### Common Field Mask Patterns

**Just IDs and labels:**
```json
{
  "fields": "id,threadId,labelIds"
}
```

**Snippet and basic headers:**
```json
{
  "fields": "id,threadId,snippet,payload/headers"
}
```

**Specific header fields (use with metadata format):**
```json
{
  "format": "metadata",
  "fields": "id,threadId,payload/headers",
  "metadataHeaders": ["From", "Subject", "Date"]
}
```

### Field Mask Syntax

- Use comma-separated paths: `"id,threadId,snippet"`
- Nested fields use slashes: `"payload/headers"`
- Wildcard for all subfields: `"payload/*"`

See [Gmail API Partial Response Documentation](https://developers.google.com/gmail/api/guides/performance#partial-response) for complete syntax.

## Examples

### Example 1: Quick Header Check
**Scenario:** Check who sent an email and when, without fetching the body

```json
{
  "messageId": "18d4a2c5f6789abc",
  "format": "metadata",
  "metadataHeaders": ["From", "Subject", "Date"]
}
```

**Why this works:** Gets only the headers you need, saves bandwidth

### Example 2: Batch Process Search Results
**Scenario:** You searched Gmail and got 50 message IDs. Get subject lines and senders.

```json
{
  "messageIds": ["id1", "id2", "id3", ...],
  "format": "metadata",
  "metadataHeaders": ["From", "Subject", "Date"],
  "fields": "id,payload/headers"
}
```

**Why this works:**
- One API call instead of 50
- Only fetches needed headers
- Parallel processing under the hood

### Example 3: Check Labels Without Content
**Scenario:** See which labels are on multiple messages

```json
{
  "messageIds": ["id1", "id2", "id3"],
  "format": "minimal",
  "fields": "id,labelIds"
}
```

**Why this works:** Minimal format is fastest, fields mask excludes everything except labels

### Example 4: Full Email Content
**Scenario:** Read the complete email with body and attachments

```json
{
  "messageId": "18d4a2c5f6789abc",
  "format": "full"
}
```

**Note:** This gets everything. Consider if you really need the full body or if metadata suffices.

## Performance Tips

1. **Start narrow, expand if needed:** Begin with `metadata` format and specific fields. Only fetch `full` if you need the body.

2. **Batch when possible:** If you have multiple message IDs, use `batchFetchFlexible` instead of calling `fetchFlexible` multiple times.

3. **Use field masks:** If you know exactly what you need, specify it with the `fields` parameter.

4. **Consider the use case:**
   - Listing emails: `minimal` or `metadata` with just From/Subject
   - Reading an email: `full` format
   - Checking labels/status: `minimal` with `fields: "id,labelIds"`
   - Searching content: `metadata` first, then `full` only if needed

## Common Patterns

### Pattern: Process Unread Emails

1. Search for unread: `gmail_search` with `query: "is:unread"`
2. Batch fetch metadata: `gerbidigm_gmail_batchFetchFlexible` with format `metadata`
3. For emails needing full content: `gerbidigm_gmail_fetchFlexible` with format `full`

### Pattern: Email Triage Dashboard

1. Fetch recent messages: `gmail_search` with appropriate query
2. Get essentials only:
   ```json
   {
     "format": "metadata",
     "metadataHeaders": ["From", "To", "Subject", "Date"],
     "fields": "id,threadId,labelIds,snippet,payload/headers"
   }
   ```

### Pattern: Attachment Inventory

1. Search for emails with attachments: `gmail_search` with `query: "has:attachment"`
2. Fetch with full format to get attachment metadata
3. Use attachment info to decide which to download with `gmail_downloadAttachment`

## Comparison with Standard Tools

| Standard Tool | Flexible Tool | Key Difference |
|---------------|---------------|----------------|
| `gmail_get` | `gerbidigm_gmail_fetchFlexible` | Flexible version supports field masks and more control |
| Multiple `gmail_get` calls | `gerbidigm_gmail_batchFetchFlexible` | Batch version is much faster for multiple messages |

The standard `gmail_get` tool has preset formats. Use the flexible tools when you need:
- Fine-grained control over fields
- Batch operations
- Performance optimization
- Specific header selection

## Troubleshooting

**Error: "Invalid field mask"**
- Check your field mask syntax (comma-separated, no spaces)
- Use slashes for nested fields: `payload/headers` not `payload.headers`

**Response is still large:**
- Make sure you're using field masks effectively
- Consider if `metadata` format suits your needs instead of `full`

**Batch fetch timing out:**
- Reduce the number of messages (max 100)
- Use more restrictive field masks
- Consider using `minimal` format for large batches

## Best Practices

1. **Know your format:** Understand what each format returns before choosing
2. **Batch when you can:** It's almost always faster than individual fetches
3. **Use metadata first:** Start with metadata and only fetch full content when needed
4. **Field masks save time:** Even a simple field mask can significantly improve performance
5. **Test your queries:** Try with a single message before batching

## Additional Resources

- [Gmail API Message Resource](https://developers.google.com/gmail/api/reference/rest/v1/users.messages)
- [Gmail API Performance Best Practices](https://developers.google.com/gmail/api/guides/performance)
- [Partial Response Field Masks](https://developers.google.com/gmail/api/guides/performance#partial-response)
