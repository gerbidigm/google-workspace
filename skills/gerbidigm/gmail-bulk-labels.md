# Gmail Bulk Operations & Label Creation Skill

This skill documents label creation and bulk message modification tools that are
available in the upstream Gmail MCP server but not covered in the core Gmail
skill, plus gerbidigm convenience tools that encode common intent directly.

## Overview

The core Gmail skill documents `gmail.modify` for single-message operations and
`gmail.listLabels` for resolving label IDs. It does **not** document:

- Creating new labels (`gmail.createLabel`)
- Modifying many messages at once (`gmail.batchModify`)
- Modifying all messages in a thread (`gmail.modifyThread`)

These tools exist and work. Use them.

## Gmail Label Model

> Gmail is label-based, not folder-based. Messages are not moved or copied —
> they exist once and carry a set of labels simultaneously. "Archive" means
> removing the INBOX label. "Trash" means adding TRASH and removing INBOX. A
> message can technically carry both INBOX and TRASH labels; the convenience
> tools below apply the conventional combination so agents don't need to reason
> about this.

## Label Creation

### `gmail.createLabel`

Creates a new Gmail label. Required before applying a label that doesn't exist
yet.

**Parameters:**

| Parameter               | Required | Values                                                      |
| :---------------------- | :------- | :---------------------------------------------------------- |
| `name`                  | Yes      | Label name. Use `/` for nesting, e.g. `Digested/2026-03-19` |
| `labelListVisibility`   | No       | `labelShow` (default), `labelShowIfUnread`, `labelHide`     |
| `messageListVisibility` | No       | `show` (default), `hide`                                    |

**Typical workflow for dated/nested labels:**

1. Call `gmail.listLabels()` to check if the label already exists
2. If not found, call `gmail.createLabel` with the full nested name
3. Use the returned label ID for subsequent `gmail.modify` / `gmail.batchModify`
   calls

```text
gmail.createLabel({ name: "Digested/2026-03-19" })
→ { id: "Label_12345", name: "Digested/2026-03-19", ... }
```

**Notes:**

- Gmail automatically creates the parent label (`Digested`) if it doesn't exist
- Label IDs are stable — cache the ID within a session rather than re-fetching
- Duplicate names return an error; always check `gmail.listLabels` first

## Bulk Message Modification

### `gmail.batchModify`

Modifies up to **1,000 messages** in a single API call. Strongly prefer this
over looping `gmail.modify` whenever you have more than one message to change.

**Parameters:**

| Parameter        | Required | Description                             |
| :--------------- | :------- | :-------------------------------------- |
| `messageIds`     | Yes      | Array of message ID strings (max 1,000) |
| `addLabelIds`    | No       | Label IDs to add (system or custom)     |
| `removeLabelIds` | No       | Label IDs to remove (system or custom)  |

**Common patterns:**

```text
# Archive a batch (remove from inbox)
gmail.batchModify({
  messageIds: ["id1", "id2", ...],
  removeLabelIds: ["INBOX"]
})

# Apply a custom label + archive in one call
gmail.batchModify({
  messageIds: ["id1", "id2", ...],
  addLabelIds: ["Label_12345"],
  removeLabelIds: ["INBOX"]
})

# Trash a batch
gmail.batchModify({
  messageIds: ["id1", "id2", ...],
  addLabelIds: ["TRASH"],
  removeLabelIds: ["INBOX"]
})

# Mark a batch as read
gmail.batchModify({
  messageIds: ["id1", "id2", ...],
  removeLabelIds: ["UNREAD"]
})
```

### `gmail.modifyThread`

Applies label changes to **every message in a thread** atomically. Use this
instead of collecting individual message IDs when operating on a full
conversation.

**Parameters:** same shape as `gmail.batchModify` but takes a single `threadId`
instead of `messageIds`.

```text
gmail.modifyThread({
  threadId: "thread_abc",
  addLabelIds: ["Label_12345"],
  removeLabelIds: ["INBOX"]
})
```

## Convenience Tools (gerbidigm)

These tools encode common intent directly — no label-ID lookup required for
system-label operations.

### `gerbidigm.gmail.bulkMarkRead`

Remove the UNREAD label from 1–1000 messages. Prefer over
`gmail.batchModify({ removeLabelIds: ["UNREAD"] })` when you don't need to
combine with other label changes.

```text
gerbidigm.gmail.bulkMarkRead({ messageIds: ["id1", "id2"] })
```

### `gerbidigm.gmail.bulkMarkUnread`

Add the UNREAD label to 1–1000 messages.

```text
gerbidigm.gmail.bulkMarkUnread({ messageIds: ["id1"] })
```

### `gerbidigm.gmail.bulkToInbox`

Add the INBOX label to 1–1000 messages, making them appear in the inbox view.
Does not remove any other labels.

```text
gerbidigm.gmail.bulkToInbox({ messageIds: ["id1", "id2"] })
```

### `gerbidigm.gmail.bulkTrash`

Add TRASH and remove INBOX from 1–1000 messages. Messages are not permanently
deleted — they move to the Trash view and are eventually purged by Gmail.

```text
gerbidigm.gmail.bulkTrash({ messageIds: ["id1", "id2", "id3"] })
```

### `gerbidigm.gmail.createLabelPath`

Create a Gmail label path with `mkdir -p` semantics — all ancestors are created
automatically if they don't exist, and existing segments are skipped. Returns
the leaf label ID and a per-segment `created`/`skipped` report.

**Use this instead of `gmail.createLabel` for any nested label creation.**
Agents do not need to know the slash convention or pre-create parent labels.

**Parameters:**

| Parameter               | Required | Description                                             |
| :---------------------- | :------- | :------------------------------------------------------ |
| `path`                  | Yes      | Full path, e.g. `"Digested/Digested-2026-03-19"`        |
| `delimiter`             | No       | Segment separator. Defaults to `"/"`                    |
| `labelListVisibility`   | No       | `labelShow` (default), `labelShowIfUnread`, `labelHide` |
| `messageListVisibility` | No       | `show` (default), `hide`                                |

```text
gerbidigm.gmail.createLabelPath({ path: "Digested/Digested-2026-03-19" })
→ {
    leafId: "Label_12345",
    leafName: "Digested/Digested-2026-03-19",
    segments: [
      { name: "Digested", id: "Label_99", created: false },
      { name: "Digested/Digested-2026-03-19", id: "Label_12345", created: true }
    ]
  }
```

**Note:** Still call `gmail.listLabels` first if you want to verify the parent
exists or the child does not — `createLabelPath` will skip existing segments
silently, but you may want to confirm state before proceeding.

## When to Use Which Tool

| Situation                      | Tool                              |
| :----------------------------- | :-------------------------------- |
| One message                    | `gmail.modify`                    |
| Multiple messages (> 1)        | `gmail.batchModify`               |
| All messages in a thread       | `gmail.modifyThread`              |
| Mark read (bulk)               | `gerbidigm.gmail.bulkMarkRead`    |
| Mark unread (bulk)             | `gerbidigm.gmail.bulkMarkUnread`  |
| Move to inbox (bulk)           | `gerbidigm.gmail.bulkToInbox`     |
| Trash messages (bulk)          | `gerbidigm.gmail.bulkTrash`       |
| Create nested label (mkdir -p) | `gerbidigm.gmail.createLabelPath` |
| Create flat label              | `gmail.createLabel`               |
| Look up label ID by name       | `gmail.listLabels`                |

## Email Management Agent Patterns

### Fetch compact → triage in memory → bulk-op

Avoid per-message round-trips by:

1. Fetching all candidate messages with `batchFetchFlexible` (metadata format,
   minimal fields)
2. Triaging entirely in memory — group by disposition (trash / archive / label)
3. Issuing one bulk call per disposition group

No API calls happen during triage; only after grouping is complete.

### Group by action before any API calls

```text
// triage in memory
const toTrash = [], toLabel = [], toMarkRead = [];
for (const msg of messages) {
  if (shouldTrash(msg)) toTrash.push(msg.id);
  else if (shouldLabel(msg)) toLabel.push(msg.id);
  else toMarkRead.push(msg.id);
}

// then bulk-operate
gerbidigm.gmail.bulkTrash({ messageIds: toTrash })
gerbidigm.gmail.bulkMarkRead({ messageIds: toMarkRead })
gmail.batchModify({
  messageIds: toLabel,
  addLabelIds: [LABEL_ID],
  removeLabelIds: ["INBOX"]
})
```

### Parallelize independent bulk ops

Trash and archive are independent — run them concurrently:

```text
await Promise.all([
  gerbidigm.gmail.bulkTrash({ messageIds: toTrash }),
  gmail.batchModify({ messageIds: toArchive, removeLabelIds: ["INBOX"] }),
]);
```

### Stay within the 1,000-message batch limit

If a triage group exceeds 1,000 messages, split into chunks of 1,000 and call in
sequence (or parallel if order doesn't matter):

```text
for (let i = 0; i < ids.length; i += 1000) {
  await gerbidigm.gmail.bulkTrash({ messageIds: ids.slice(i, i + 1000) });
}
```

## Full Example: Daily Digest Archival Workflow

```text
1. gerbidigm.gmail.createLabelPath({ path: "Digested/Digested-2026-03-19" })
   → save leafId as DIGESTED_ID

2. gmail.search({ query: 'label:"To Digest"', maxResults: 500 })
   → collect all messageIds

3. gmail.batchModify({
     messageIds: [...all ids...],
     addLabelIds: [DIGESTED_ID],
     removeLabelIds: ["INBOX", "Label_ToDigest"]
   })
   → done in one round trip
```
