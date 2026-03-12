# Quick Test Prompts for Claude Desktop

Copy and paste these prompts directly into Claude Desktop to test the flexible Gmail tools.

## Setup

First, get some message IDs to work with:

```
Search my Gmail for recent emails from the last 24 hours and show me 5 message IDs.
```

Save a few message IDs from the response. Replace `<MSG_ID>` in the prompts below with actual IDs.

---

## Test 1: Verify Tools Exist

```
What MCP tools are available that start with "gerbidigm_gmail"? List them with their descriptions.
```

**Expected:** Should show `gerbidigm_gmail_fetchFlexible` and `gerbidigm_gmail_batchFetchFlexible`

---

## Test 2: Quick Metadata Fetch

```
Use the gerbidigm_gmail_fetchFlexible tool to fetch message <MSG_ID> with these parameters:
- format: "metadata"
- metadataHeaders: ["From", "Subject", "Date"]

Show me just the From, Subject, and Date from the response.
```

---

## Test 3: Lightning Fast Minimal Fetch

```
Use gerbidigm_gmail_fetchFlexible to fetch message <MSG_ID> with:
- format: "minimal"
- fields: "id,labelIds"

Show me what labels this message has.
```

---

## Test 4: Batch Fetch Comparison

First, get 5 message IDs:
```
Search Gmail for "is:inbox" and give me exactly 5 message IDs as a JSON array.
```

Then use batch fetch:
```
Use gerbidigm_gmail_batchFetchFlexible to fetch those 5 message IDs with:
- format: "metadata"
- metadataHeaders: ["From", "Subject", "Date"]
- fields: "id,snippet,payload/headers"

Create a table showing: From | Subject | Snippet for each email.
```

---

## Test 5: Full Email with Optimization

```
Use gerbidigm_gmail_fetchFlexible to get message <MSG_ID> with:
- format: "full"
- fields: "id,threadId,snippet,payload(headers,body)"

Can you extract and show me the email body content?
```

---

## Test 6: Smart Email Triage

```
Help me triage my unread emails:
1. Search for unread emails (limit 10)
2. Use gerbidigm_gmail_batchFetchFlexible to efficiently fetch their metadata
3. Show me a prioritized list with:
   - Sender
   - Subject
   - Date
   - Quick summary of the snippet

Use format "metadata" with only the headers we need.
```

---

## Test 7: Find Emails with Attachments

```
Search my Gmail for emails with attachments from the last 7 days.
Then use gerbidigm_gmail_batchFetchFlexible with format "full" to check
which ones have attachments. List the emails and their attachment filenames.
```

---

## Test 8: Label Analysis

```
Search for my 20 most recent emails. Use gerbidigm_gmail_batchFetchFlexible
with format "minimal" and fields "id,labelIds" to efficiently fetch just
their labels. Show me a breakdown of which labels are most common.
```

---

## Test 9: Performance Comparison

```
Let's compare the standard gmail_get tool with the flexible version:

1. First, use gmail_get to fetch message <MSG_ID> with format "full"
2. Then, use gerbidigm_gmail_fetchFlexible to fetch the same message with:
   - format: "full"
   - fields: "id,threadId,snippet,payload/headers"

Tell me which response was faster and which had a smaller response size.
```

---

## Test 10: Error Handling

```
Use gerbidigm_gmail_batchFetchFlexible to fetch these message IDs:
["DEFINITELY_INVALID_ID_12345", "<VALID_MSG_ID>"]

with format "minimal"

Show me how the tool handles the invalid ID while still returning the valid one.
```

---

## Advanced Test: Custom Field Selection

```
I want to extract just the email addresses from recent emails.

Search for 5 recent emails, then use gerbidigm_gmail_batchFetchFlexible with:
- format: "metadata"
- metadataHeaders: ["From", "To", "Cc"]
- fields: "id,payload/headers"

Extract and list all unique email addresses found.
```

---

## Real-World Scenario: Morning Briefing

```
Create my morning email briefing:
1. Find unread emails in my inbox
2. Use the flexible Gmail tools to efficiently fetch just what we need
3. Categorize them as:
   - Urgent (from my manager, time-sensitive keywords)
   - Important (projects I'm working on)
   - FYI (newsletters, notifications)
4. Show a summary with sender, subject, and your assessment

Use the batch fetch tool for efficiency!
```

---

## Notes

- Replace `<MSG_ID>` with actual message IDs from your Gmail
- The first prompt helps you get message IDs to use in other tests
- Response times will vary based on:
  - Number of messages
  - Format selected
  - Field mask specificity
  - Email size and complexity

## What to Look For

✅ **Working correctly:**
- Tools execute without errors
- Response contains requested data only
- Batch operations process multiple messages
- Field masks reduce response size

❌ **Potential issues:**
- "Tool not found" → Rebuild and restart Claude Desktop
- "Invalid credentials" → Re-authenticate with auth-utils.js
- "Invalid field mask" → Check syntax (no spaces, use commas and slashes)
