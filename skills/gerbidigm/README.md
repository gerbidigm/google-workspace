# Gerbidigm Skills

This directory contains skill definitions for Gerbidigm custom MCP tools.

## What are Skills?

Skills are markdown documentation files that provide guidance to AI agents on
how to effectively use MCP tools. They include:

- Detailed usage instructions
- Common patterns and examples
- Best practices
- Troubleshooting tips
- Performance optimization guidance

## Available Skills

### `SETUP.md`

Quick setup guide for Gerbidigm tools, including:

- Google Workspace authentication
- Gemini API key configuration
- Installation and verification steps
- Troubleshooting common issues

**Use this skill when:** Setting up Gerbidigm tools for the first time or
troubleshooting configuration issues.

### `gmail-fetch.md`

Comprehensive guide for using the flexible Gmail fetch tools:

- `gerbidigm_gmail_fetchFlexible` - Single message fetch with field control
- `gerbidigm_gmail_batchFetchFlexible` - Batch fetch multiple messages

These tools provide fine-grained control over Gmail API responses through:

- Format selection (minimal, metadata, full, raw)
- Field masks for partial responses
- Batch operations for efficiency

**Use this skill when:** Working with Gmail messages and you need performance
optimization or specific field control.

**Related files:**

- `TESTING.md` - Comprehensive testing guide with scenarios
- `TEST_PROMPTS.md` - Quick copy-paste test prompts for Claude Desktop

### `docs-image-analysis.md`

Complete workflow for extracting and analyzing images from Google Docs:

- `gerbidigm_docs_extractImages` - Extract all images from a document
- `gerbidigm_gemini_describeImage` - Analyze single image with Gemini AI
- `gerbidigm_gemini_describeImageBatch` - Batch analyze multiple images

Covers end-to-end workflows including:

- Extracting images with metadata and positioning
- AI-powered image descriptions and analysis
- Cost optimization and batch processing strategies
- Technical diagram analysis, alt text generation, data extraction

**Use this skill when:** Working with images in Google Docs, generating
accessibility content, analyzing diagrams, or extracting visual information.

**Prerequisites:** Requires `GEMINI_API_KEY` environment variable (see
`SETUP.md`)

### `docs-image-insertion.md`

Complete guide for creating Google Docs with images:

- `gerbidigm_drive_uploadImage` - Upload local images to Google Drive
- `gerbidigm_docs_insertImage` - Insert images into existing documents
- `gerbidigm_docs_createWithImages` - Create new documents with mixed text/image
  content

Covers comprehensive workflows including:

- Image positioning with character-level precision
- Image sizing in points (1 inch = 72 points)
- Multi-tab document support
- Batch upload patterns
- Document structure best practices
- Common workflows (reports, galleries, technical docs)

**Use this skill when:** Creating documents with embedded images, building
reports with charts/diagrams, generating image galleries, or inserting
screenshots into existing docs.

**Prerequisites:** Google Workspace authentication (no Gemini API key needed)

### `docs-editing.md`

Precision editing of Google Docs content using index-based tools:

- `gerbidigm_docs_getStructure` - Document structure with start/end indices for
  every element
- `gerbidigm_docs_findTextRange` - Locate text by content, returns indices ready
  for deletion
- `gerbidigm_docs_deleteRange` - Delete a single content range by index
- `gerbidigm_docs_deleteRanges` - Delete multiple ranges in one operation

Covers the standard delete-by-content workflow (`findTextRange` →
`deleteRanges`), structural editing via `getStructure`, multi-edit index safety,
and why `docs.replaceText("")` fails and what to use instead.

**Use this skill when:** Deleting content from a document, removing all
occurrences of a phrase, or making any structural edit where you need to address
content by position.

## Using Skills with Claude Code

Skills can be loaded during a conversation to provide context-specific guidance.
There are two ways to access skills:

### 1. Manual Reference (Current)

Copy relevant sections from skill markdown files into your prompts or reference
them when needed.

### 2. MCP Skill Protocol (Future)

When the MCP protocol adds skill support, these files will be automatically
discoverable and loadable by AI agents through the MCP server.

## Skill File Structure

Each skill should include:

1. **Title and Overview** - What the skill covers
2. **When to Use** - Scenarios where this skill is relevant
3. **Core Concepts** - Key ideas and options
4. **Examples** - Practical usage patterns
5. **Best Practices** - Dos and don'ts
6. **Troubleshooting** - Common issues and solutions
7. **Resources** - Links to API docs and references

## Adding New Skills

When creating custom Gerbidigm tools, consider adding a skill file if:

- The tool has multiple usage patterns
- There are performance considerations
- The tool wraps complex APIs
- Best practices would benefit users
- Common mistakes should be documented

### Skill Template

```markdown
# Tool Name Skill

## Overview

Brief description of what this skill covers

## When to Use This Tool

Specific scenarios and use cases

## Key Concepts

Important options, parameters, or patterns

## Examples

Practical examples with explanations

## Best Practices

Recommended approaches

## Troubleshooting

Common issues and solutions

## Additional Resources

Links to relevant documentation
```

## Contributing

Skills should be:

- **Clear and concise** - Easy to understand quickly
- **Example-driven** - Show, don't just tell
- **Practical** - Focus on real-world usage
- **Up-to-date** - Keep in sync with tool implementations

When updating tools, remember to update corresponding skills!
