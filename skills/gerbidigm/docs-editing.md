# Google Docs Structural Editing

## Overview

This skill covers precision editing of Google Docs content using index-based
tools:

- **`gerbidigm.docs.getStructure`** — Document structure with start/end indices
  for every element
- **`gerbidigm.docs.findTextRange`** — Locate text by content, returns indices
  ready for deletion
- **`gerbidigm.docs.deleteRange`** — Delete a single content range by index
- **`gerbidigm.docs.deleteRanges`** — Delete multiple ranges in one operation

## When to Use These Tools

- Deleting a paragraph, sentence, or phrase from a document
- Removing all occurrences of a repeated string
- Making structural edits where `docs.replaceText` is insufficient (e.g.,
  replacing with nothing — replaceText rejects empty strings)
- Any edit where you need to know the exact position of content

## Core Concept: Index-Based Editing

Google Docs represent content as a flat sequence of characters, each with an
absolute integer index starting at 1. Every paragraph, table cell, and section
break has a `startIndex` (inclusive) and `endIndex` (exclusive).

```
Index:  1  2  3  4  5  6  7  8  9  10 11 12
Chars:  H  e  l  l  o  ,  ' '  w  o  r  l  d  \n
```

A deletion of `[1, 13)` removes "Hello, world\n" entirely.

**Key rules:**

- Indices are 1-based. `startIndex >= 1` always.
- `endIndex` is exclusive: to delete a paragraph at `[5, 20)`, pass exactly
  those values.
- A paragraph's trailing `\n` is at `endIndex - 1`. To delete the whole
  paragraph including its newline, use the paragraph's `startIndex` and
  `endIndex` directly.
- After any deletion, all indices after the deleted range shift down by
  `endIndex - startIndex`. Always fetch fresh indices or use end-to-start
  ordering when doing multiple edits.

## The Standard Delete Workflow

### Deleting by content (most common)

```
1. docs.findTextRange  →  [{startIndex, endIndex, context}, ...]
2. docs.deleteRanges   ←  pass the matches array directly
```

`findTextRange` returns matches sorted end-of-document first. `deleteRanges`
sorts internally and executes as a single API call — no index adjustment needed
on your part.

### Deleting by structure (when you need to see the layout)

```
1. docs.getStructure   →  full element tree with indices
2. docs.deleteRange    ←  single targeted range from the tree
   or
   docs.deleteRanges   ←  multiple ranges from the tree
```

## Tool Reference

### `docs.findTextRange`

Find all occurrences of a string and get their absolute indices.

**Parameters:**

| Parameter       | Type    | Required | Description             |
| --------------- | ------- | -------- | ----------------------- |
| `documentId`    | string  | ✅       | Doc ID or URL           |
| `text`          | string  | ✅       | Exact text to find      |
| `tabId`         | string  | ⬜       | Limit search to one tab |
| `caseSensitive` | boolean | ⬜       | Default: false          |

**Returns:**

```json
{
  "count": 2,
  "note": "Matches are sorted end-of-document first. Pass the full matches array to deleteRanges to delete all occurrences safely.",
  "matches": [
    {
      "startIndex": 142,
      "endIndex": 155,
      "context": "…prior work. [DRAFT NOTE] Please re…",
      "tabId": "t.0",
      "tabTitle": "Main"
    },
    {
      "startIndex": 42,
      "endIndex": 55,
      "context": "…introduction. [DRAFT NOTE] This sec…",
      "tabId": "t.0",
      "tabTitle": "Main"
    }
  ]
}
```

Use the `context` field to confirm you found the right content before deleting.

**Handles cross-run matches:** Text runs within a paragraph may be split by
formatting. `findTextRange` reconstructs the full paragraph text before
searching, so matches that span run boundaries are found correctly.

---

### `docs.deleteRanges`

Delete multiple ranges in one operation. Always prefer this over calling
`deleteRange` in a loop.

**Parameters:**

| Parameter    | Type         | Required | Description                               |
| ------------ | ------------ | -------- | ----------------------------------------- |
| `documentId` | string       | ✅       | Doc ID or URL                             |
| `ranges`     | IndexRange[] | ✅       | Array of `{startIndex, endIndex, tabId?}` |

**Behavior:**

- Sorts ranges descending internally — end-of-document first
- Validates all ranges before touching the document
- Rejects overlapping ranges with a clear error
- Executes as a single `batchUpdate` call

**Returns:**

```json
{
  "success": true,
  "deletedCount": 2,
  "deletedRanges": [
    { "startIndex": 142, "endIndex": 155 },
    { "startIndex": 42, "endIndex": 55 }
  ]
}
```

---

### `docs.deleteRange`

Delete a single content range. Use this when you have a specific index from
`getStructure` or when there's only one match.

**Parameters:**

| Parameter    | Type   | Required | Description                        |
| ------------ | ------ | -------- | ---------------------------------- |
| `documentId` | string | ✅       | Doc ID or URL                      |
| `startIndex` | number | ✅       | Start of range (inclusive, >= 1)   |
| `endIndex`   | number | ✅       | End of range (exclusive)           |
| `tabId`      | string | ⬜       | Target tab in a multi-tab document |

> **Do not** use `docs.replaceText` with an empty string to delete content — it
> fails with _"Insert text requests must specify text to insert."_ Use
> `deleteRange` or `deleteRanges` instead.

#### Anchor warning: when deleting a full paragraph fails

The Docs API rejects a delete if the `endIndex` equals the `startIndex` of a
paragraph that has `hasLeadingAnchor: true` in `getStructure` output. This flag
means a bookmark or named-range anchor is positioned at the start of that
paragraph. Merging the preceding paragraph into it (by deleting the `\n`
terminator) is blocked.

**Workaround:** use `endIndex - 1` to clear the paragraph's text content without
touching the `\n`. This leaves an empty line, but avoids the error.

```
# Paragraph to delete: startIndex: 100, endIndex: 134
# Next paragraph has hasLeadingAnchor: true

# This FAILS (tries to merge across the anchor):
deleteRange(startIndex: 100, endIndex: 134)

# This WORKS (clears content, leaves empty line):
deleteRange(startIndex: 100, endIndex: 133)
```

The `hasLeadingAnchor` flag is only present when true — its absence means the
full-paragraph delete (including `\n`) is safe.

---

### `docs.getStructure`

Return the document as a flat list of content blocks with indices. Use this when
you need to understand the layout before editing — for example, to delete a
whole paragraph or table by its position in the document.

**Parameters:**

| Parameter      | Type     | Required | Description                                                                              |
| -------------- | -------- | -------- | ---------------------------------------------------------------------------------------- |
| `documentId`   | string   | ✅       | Doc ID or URL                                                                            |
| `tabId`        | string   | ⬜       | Limit to one tab; returns all tabs if omitted                                            |
| `elementTypes` | string[] | ⬜       | Only return these types: `paragraph`, `table`, `sectionBreak`, `tableOfContents`         |
| `namedStyles`  | string[] | ⬜       | Only return paragraphs with these styles (see below). Non-paragraph elements unaffected. |
| `fromIndex`    | number   | ⬜       | Only return elements whose endIndex > fromIndex                                          |
| `toIndex`      | number   | ⬜       | Only return elements whose startIndex < toIndex                                          |
| `includeRuns`  | boolean  | ⬜       | Include per-run detail in paragraphs. Default: true. Set false to halve response size.   |

**Named style values** (for `namedStyles`): `NORMAL_TEXT`, `TITLE`, `SUBTITLE`,
`HEADING_1`, `HEADING_2`, `HEADING_3`, `HEADING_4`, `HEADING_5`, `HEADING_6`

**Response shape:**

```json
{
  "documentId": "1ABC...",
  "title": "My Document",
  "tabs": [
    {
      "tabId": "t.0",
      "title": "Main",
      "elements": [
        {
          "type": "paragraph",
          "startIndex": 1,
          "endIndex": 13,
          "text": "Introduction\n",
          "namedStyleType": "HEADING_1",
          "runs": [
            { "startIndex": 1, "endIndex": 12, "text": "Introduction" },
            { "startIndex": 12, "endIndex": 13, "text": "\n" }
          ]
        },
        {
          "type": "table",
          "startIndex": 13,
          "endIndex": 80,
          "rows": 3,
          "cols": 2,
          "cells": [...]
        }
      ]
    }
  ]
}
```

**Reducing response size for large documents:**

| Goal                              | Parameters to use                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| Document outline only             | `elementTypes: ["paragraph"], namedStyles: ["HEADING_1","HEADING_2","HEADING_3"]`    |
| No run detail                     | `includeRuns: false`                                                                 |
| Scope to a known section          | `fromIndex: 500, toIndex: 1200`                                                      |
| Paragraphs only, compact          | `elementTypes: ["paragraph"], includeRuns: false`                                    |
| Full outline + section boundaries | `elementTypes: ["paragraph","sectionBreak"], namedStyles: ["HEADING_1","HEADING_2"]` |

> **Context note:** For large documents, `getStructure` without filters returns
> substantial JSON that stays in your context window. Prefer `findTextRange`
> when you know the text to target. When you do need structure, use filters —
> `includeRuns: false` alone cuts paragraph output roughly in half.

## Examples

### Delete all occurrences of a phrase

```
docs.findTextRange(documentId, "TODO: ")
→ { count: 3, matches: [{startIndex:200,...}, {startIndex:120,...}, {startIndex:40,...}] }

docs.deleteRanges(documentId, matches)
→ { success: true, deletedCount: 3 }
```

### Delete a specific paragraph by content

```
docs.findTextRange(documentId, "This section is intentionally left blank.")
→ { count: 1, matches: [{startIndex: 450, endIndex: 492, context: "…\n[This section is intentionally left blank.]\n…"}] }

docs.deleteRange(documentId, startIndex: 450, endIndex: 492)
→ { success: true }
```

### Delete a whole paragraph including its newline (from structure)

```
docs.getStructure(documentId)
→ elements: [..., { type: "paragraph", startIndex: 60, endIndex: 95, text: "Stale heading\n" }, ...]

docs.deleteRange(documentId, startIndex: 60, endIndex: 95)
→ removes the paragraph and its trailing newline cleanly
```

### Replace an image (insert new, delete old)

```
# Find the old image's position
docs.getStructure(documentId)
→ elements: [..., { type: "paragraph", startIndex: 100, endIndex: 101, text: "\n", runs: [{startIndex:100, endIndex:101}] }, ...]
# (images occupy 1 character — a paragraph element containing a single run with no textRun content)

# Insert replacement at the same position
docs.insertImage(documentId, driveFileId: newId, position: 100)

# Delete the now-shifted original (at index 101 after insertion)
docs.deleteRange(documentId, startIndex: 101, endIndex: 102)
```

## Multiple Sequential Edits

If you need to make several edits that are **not** from a single `findTextRange`
call — for example, deleting different things found by separate searches —
always work end-of-document first:

1. Collect all ranges you plan to delete
2. Sort them descending by `startIndex`
3. Pass the full sorted array to `deleteRanges`

This is exactly what `deleteRanges` does internally, so if you've collected
ranges from multiple `findTextRange` calls, you can merge and pass them all at
once:

```
ranges = [...matchesFromSearch1, ...matchesFromSearch2]
docs.deleteRanges(documentId, ranges)
# deleteRanges sorts and deduplicates ordering for you
```

> **Note:** Overlapping ranges are rejected. If two searches return overlapping
> matches, resolve the overlap (take the outer boundary) before calling
> `deleteRanges`.

## Troubleshooting

### "Insert text requests must specify text to insert"

You called `docs.replaceText` with `replaceText: ""`. Use `docs.deleteRange` or
`docs.findTextRange` + `docs.deleteRanges` instead.

### "startIndex must be >= 1"

Index 0 is not valid in the Google Docs API. The document body starts at
index 1. Check your source — `getStructure` always returns indices >= 1.

### "endIndex must be > startIndex"

You passed equal or reversed indices. Verify the range from `getStructure` or
`findTextRange` was copied correctly.

### "Ranges overlap"

Two ranges in your `deleteRanges` call share index space. Inspect the ranges,
identify the overlap, and either merge them into one range or remove the
duplicate.

### Deleted wrong content

Use the `context` field from `findTextRange` to confirm the match before
deleting. For `getStructure`-based edits, read the `text` field of the element
before passing its indices to `deleteRange`.
