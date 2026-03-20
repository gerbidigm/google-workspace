/**
 * @license
 * Copyright 2026 Charlie Voiselle
 * SPDX-License-Identifier: Apache-2.0
 */

import { google, docs_v1 } from 'googleapis';
import { AuthManager } from '../../auth/AuthManager';
import { extractDocId } from '../../utils/IdUtils';
import { logToFile } from '../../utils/logger';
import { gaxiosOptions } from '../../utils/GaxiosConfig';

// ---------------------------------------------------------------------------
// Inline token types
// ---------------------------------------------------------------------------

type SpanType = 'text' | 'bold' | 'italic' | 'bold_italic' | 'code';

interface InlineSpan {
  type: SpanType;
  text: string;
}

// ---------------------------------------------------------------------------
// Block types
// ---------------------------------------------------------------------------

interface HeadingBlock {
  type: 'heading';
  level: number; // 1–6
  spans: InlineSpan[];
}

interface ParagraphBlock {
  type: 'paragraph';
  spans: InlineSpan[];
}

interface ListItem {
  depth: number;   // 0 = top-level; each level adds one \t in the inserted text
  ordered: boolean;
  spans: InlineSpan[];
}

interface ListBlock {
  type: 'list';
  items: ListItem[];
}

type Block = HeadingBlock | ParagraphBlock | ListBlock;

// ---------------------------------------------------------------------------
// Inline parser
// ---------------------------------------------------------------------------

/**
 * Parse inline markdown into a flat list of typed spans.
 * Handles ***bold italic***, **bold**, *italic*, `code`.
 * Processed in order so bold+italic is matched before bold or italic alone.
 */
function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const re = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/gs;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      spans.push({ type: 'text', text: text.slice(last, m.index) });
    }
    if (m[1] !== undefined) spans.push({ type: 'bold_italic', text: m[1] });
    else if (m[2] !== undefined) spans.push({ type: 'bold', text: m[2] });
    else if (m[3] !== undefined) spans.push({ type: 'italic', text: m[3] });
    else if (m[4] !== undefined) spans.push({ type: 'code', text: m[4] });
    last = re.lastIndex;
  }
  if (last < text.length) {
    spans.push({ type: 'text', text: text.slice(last) });
  }
  return spans;
}

function spansText(spans: InlineSpan[]): string {
  return spans.map((s) => s.text).join('');
}

// ---------------------------------------------------------------------------
// Block (line-level) parser
// ---------------------------------------------------------------------------

const LIST_LINE_RE_UL = /^(\s*)([-*+])\s+(.*)/;
const LIST_LINE_RE_OL = /^(\s*)(\d+)\.\s+(.*)/;

function isListLine(line: string): boolean {
  return LIST_LINE_RE_UL.test(line) || LIST_LINE_RE_OL.test(line);
}

/**
 * Parse a markdown string into a sequence of block-level elements.
 * Consecutive list items are grouped into a single ListBlock.
 * Paragraph lines separated by blank lines become separate ParagraphBlocks.
 * Paragraph lines NOT separated by a blank line are joined with a space
 * (standard markdown paragraph continuation).
 */
function parseMarkdown(markdown: string): Block[] {
  const lines = markdown.split('\n');
  const blocks: Block[] = [];
  let paraLines: string[] = [];

  function flushParagraph(): void {
    const text = paraLines.join(' ').trim();
    paraLines = [];
    if (text) blocks.push({ type: 'paragraph', spans: parseInline(text) });
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Heading
    const hm = line.match(/^(#{1,6})\s+(.*)/);
    if (hm) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        level: hm[1].length,
        spans: parseInline(hm[2].trim()),
      });
      i++;
      continue;
    }

    // List block — collect all consecutive list lines (blank lines between
    // items are allowed and preserved as long as a list line follows)
    if (isListLine(line)) {
      flushParagraph();
      const items: ListItem[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const um = l.match(LIST_LINE_RE_UL);
        const om = l.match(LIST_LINE_RE_OL);
        if (um) {
          items.push({
            depth: Math.floor(um[1].length / 2),
            ordered: false,
            spans: parseInline(um[3]),
          });
          i++;
        } else if (om) {
          items.push({
            depth: Math.floor(om[1].length / 2),
            ordered: true,
            spans: parseInline(om[3]),
          });
          i++;
        } else if (l.trim() === '') {
          // Blank line: peek ahead — if next non-blank is a list line, continue
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          if (j < lines.length && isListLine(lines[j])) {
            i = j;
          } else {
            i = j;
            break;
          }
        } else {
          break;
        }
      }
      if (items.length > 0) blocks.push({ type: 'list', items });
      continue;
    }

    // Blank line → end of paragraph
    if (line.trim() === '') {
      flushParagraph();
      i++;
      continue;
    }

    // Paragraph continuation
    paraLines.push(line);
    i++;
  }

  flushParagraph();
  return blocks;
}

// ---------------------------------------------------------------------------
// batchUpdate request builder
// ---------------------------------------------------------------------------

function makeLocation(
  index: number,
  tabId?: string,
): docs_v1.Schema$Location {
  return tabId ? { index, tabId } : { index };
}

function makeRange(
  startIndex: number,
  endIndex: number,
  tabId?: string,
): docs_v1.Schema$Range {
  return tabId
    ? { startIndex, endIndex, tabId }
    : { startIndex, endIndex };
}

/**
 * Generate updateTextStyle requests for any non-plain spans.
 * `basePos` is the document index where the first character of these spans
 * was inserted.
 */
function inlineStyleRequests(
  spans: InlineSpan[],
  basePos: number,
  tabId?: string,
): docs_v1.Schema$Request[] {
  const requests: docs_v1.Schema$Request[] = [];
  let pos = basePos;
  for (const span of spans) {
    const len = span.text.length;
    if (len > 0 && span.type !== 'text') {
      const range = makeRange(pos, pos + len, tabId);
      if (span.type === 'bold') {
        requests.push({
          updateTextStyle: {
            range,
            textStyle: { bold: true },
            fields: 'bold',
          },
        });
      } else if (span.type === 'italic') {
        requests.push({
          updateTextStyle: {
            range,
            textStyle: { italic: true },
            fields: 'italic',
          },
        });
      } else if (span.type === 'bold_italic') {
        requests.push({
          updateTextStyle: {
            range,
            textStyle: { bold: true, italic: true },
            fields: 'bold,italic',
          },
        });
      } else if (span.type === 'code') {
        requests.push({
          updateTextStyle: {
            range,
            textStyle: { weightedFontFamily: { fontFamily: 'Courier New' } },
            fields: 'weightedFontFamily',
          },
        });
      }
    }
    pos += len;
  }
  return requests;
}

/**
 * Convert parsed blocks into a sequence of Docs API batchUpdate requests.
 * All index arithmetic is relative to `baseIndex` (the insertion point in
 * the live document).  Since batchUpdate applies requests in order, each
 * insertText shifts subsequent positions forward by its length — `offset`
 * tracks the cumulative shift.
 */
function blocksToRequests(
  blocks: Block[],
  baseIndex: number,
  tabId?: string,
): docs_v1.Schema$Request[] {
  const requests: docs_v1.Schema$Request[] = [];
  let offset = 0;

  for (const block of blocks) {
    const blockStart = baseIndex + offset;

    if (block.type === 'heading') {
      const raw = spansText(block.spans) + '\n';
      requests.push({
        insertText: {
          location: makeLocation(blockStart, tabId),
          text: raw,
        },
      });
      requests.push({
        updateParagraphStyle: {
          range: makeRange(blockStart, blockStart + raw.length, tabId),
          paragraphStyle: { namedStyleType: `HEADING_${block.level}` },
          fields: 'namedStyleType',
        },
      });
      requests.push(...inlineStyleRequests(block.spans, blockStart, tabId));
      offset += raw.length;
    } else if (block.type === 'paragraph') {
      const raw = spansText(block.spans) + '\n';
      requests.push({
        insertText: {
          location: makeLocation(blockStart, tabId),
          text: raw,
        },
      });
      // Explicitly reset to NORMAL_TEXT so the paragraph does not inherit
      // a heading style from whatever is at the insertion point.
      requests.push({
        updateParagraphStyle: {
          range: makeRange(blockStart, blockStart + raw.length, tabId),
          paragraphStyle: { namedStyleType: 'NORMAL_TEXT' },
          fields: 'namedStyleType',
        },
      });
      requests.push(...inlineStyleRequests(block.spans, blockStart, tabId));
      offset += raw.length;
    } else if (block.type === 'list') {
      // The Docs API applies a single bulletGlyphPreset to the entire range
      // covered by createParagraphBullets, so mixed ordered/unordered items
      // in the same list must be split into separate sub-lists.
      const subLists: ListItem[][] = [];
      let current: ListItem[] = [];
      for (const item of block.items) {
        if (current.length > 0 && current[0].ordered !== item.ordered) {
          subLists.push(current);
          current = [];
        }
        current.push(item);
      }
      if (current.length > 0) subLists.push(current);

      for (const subList of subLists) {
        const subStart = baseIndex + offset;

        // Build the raw text: each item is prefixed with \t × depth.
        // The Docs API uses leading tabs to determine nesting level when
        // createParagraphBullets is applied.
        let raw = '';
        for (const item of subList) {
          raw += '\t'.repeat(item.depth) + spansText(item.spans) + '\n';
        }

        requests.push({
          insertText: {
            location: makeLocation(subStart, tabId),
            text: raw,
          },
        });

        const preset = subList[0].ordered
          ? 'NUMBERED_DECIMAL_ALPHA_ROMAN'
          : 'BULLET_DISC_CIRCLE_SQUARE';
        requests.push({
          createParagraphBullets: {
            range: makeRange(subStart, subStart + raw.length, tabId),
            bulletGlyphPreset: preset,
          },
        });

        // Inline formatting: track position including the leading \t chars.
        let textPos = 0;
        for (const item of subList) {
          textPos += item.depth; // skip \t prefix chars
          requests.push(
            ...inlineStyleRequests(item.spans, subStart + textPos, tabId),
          );
          textPos += spansText(item.spans).length + 1; // +1 for \n
        }

        offset += raw.length;
      }
    }
  }

  return requests;
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class DocsMarkdownService {
  constructor(private authManager: AuthManager) {}

  private async getDocsClient(): Promise<docs_v1.Docs> {
    const auth = await this.authManager.getAuthenticatedClient();
    const options = { ...gaxiosOptions, auth };
    return google.docs({ version: 'v1', ...options });
  }

  private handleError(error: unknown, context: string) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: `${context}: ${message}` }, null, 2),
        },
      ],
    };
  }

  /** Recursively flatten nested tabs into a single array. */
  private flattenTabs(tabs: docs_v1.Schema$Tab[]): docs_v1.Schema$Tab[] {
    return tabs.flatMap((tab) => {
      const children = tab.childTabs
        ? this.flattenTabs(tab.childTabs)
        : [];
      return [tab, ...children];
    });
  }

  /** Resolve an index or the string "end" to a numeric document index. */
  private async resolveIndex(
    docs: docs_v1.Docs,
    documentId: string,
    index: number | 'end',
    tabId?: string,
  ): Promise<number> {
    if (typeof index === 'number') return index;

    const res = await docs.documents.get({
      documentId,
      fields: 'tabs',
      includeTabsContent: true,
    });

    const tabs = this.flattenTabs(res.data.tabs ?? []);
    let content: docs_v1.Schema$StructuralElement[] | undefined;

    if (tabId) {
      const tab = tabs.find((t) => t.tabProperties?.tabId === tabId);
      if (!tab) throw new Error(`Tab with ID "${tabId}" not found.`);
      content = tab.documentTab?.body?.content;
    } else if (tabs.length > 0) {
      content = tabs[0].documentTab?.body?.content;
    }

    const lastElement = content?.[content.length - 1];
    const endIndex = lastElement?.endIndex ?? 1;
    return Math.max(1, endIndex - 1);
  }

  /**
   * Insert markdown content into a Google Doc at a specified index,
   * converting it to native Docs formatting in a single batchUpdate.
   */
  public insertMarkdown = async ({
    documentId: docInput,
    markdown,
    index,
    tabId,
  }: {
    documentId: string;
    markdown: string;
    index: number | 'end';
    tabId?: string;
  }) => {
    try {
      const documentId = extractDocId(docInput) ?? docInput;
      const docs = await this.getDocsClient();
      const baseIndex = await this.resolveIndex(docs, documentId, index, tabId);

      logToFile(
        `[DocsMarkdownService] insertMarkdown at index ${baseIndex} in ${documentId}`,
      );

      const blocks = parseMarkdown(markdown);
      if (blocks.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                { inserted: 0, blocks: 0, message: 'No content to insert.' },
                null,
                2,
              ),
            },
          ],
        };
      }

      const requests = blocksToRequests(blocks, baseIndex, tabId);

      // Count characters that will be inserted (excluding style requests).
      const charsInserted = requests
        .filter((r) => r.insertText?.text)
        .reduce((sum, r) => sum + (r.insertText!.text!.length), 0);

      await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests },
      });

      logToFile(
        `[DocsMarkdownService] inserted ${charsInserted} chars via ${requests.length} requests`,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                documentId,
                insertedAt: baseIndex,
                charsInserted,
                blocks: blocks.length,
                requests: requests.length,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return this.handleError(error, 'gerbidigm.docs.insertMarkdown');
    }
  };
}
