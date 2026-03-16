/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { google, docs_v1 } from 'googleapis';
import { AuthManager } from '../../auth/AuthManager';
import { extractDocId } from '../../utils/IdUtils';
import { logToFile } from '../../utils/logger';
import { gaxiosOptions } from '../../utils/GaxiosConfig';

interface TextRun {
  startIndex: number;
  endIndex: number;
  text: string;
}

interface ParagraphBlock {
  type: 'paragraph';
  startIndex: number;
  endIndex: number;
  text: string;
  namedStyleType?: string;
  runs?: TextRun[];
}

interface TableCellBlock {
  startIndex: number;
  endIndex: number;
  text: string;
}

interface TableBlock {
  type: 'table';
  startIndex: number;
  endIndex: number;
  rows: number;
  cols: number;
  cells: TableCellBlock[];
}

interface SectionBreakBlock {
  type: 'sectionBreak';
  startIndex: number;
  endIndex: number;
}

interface TableOfContentsBlock {
  type: 'tableOfContents';
  startIndex: number;
  endIndex: number;
}

type ContentBlock =
  | ParagraphBlock
  | TableBlock
  | SectionBreakBlock
  | TableOfContentsBlock;

interface TextMatch {
  startIndex: number;
  endIndex: number;
  /** Surrounding text for confirmation — ~30 chars before/after the match. */
  context: string;
  tabId?: string;
  tabTitle?: string;
}

interface IndexRange {
  startIndex: number;
  endIndex: number;
  tabId?: string;
}

/**
 * Service for structural read and edit operations on Google Docs.
 * Exposes index-aware document structure for precision edits like
 * deleting content ranges.
 */
export class DocsEditService {
  constructor(private authManager: AuthManager) {}

  private async getDocsClient(): Promise<docs_v1.Docs> {
    const auth = await this.authManager.getAuthenticatedClient();
    const options = { ...gaxiosOptions, auth };
    return google.docs({ version: 'v1', ...options });
  }

  private _flattenTabs(tabs: docs_v1.Schema$Tab[]): docs_v1.Schema$Tab[] {
    return tabs.flatMap((tab) => {
      const children = tab.childTabs ? this._flattenTabs(tab.childTabs) : [];
      return [tab, ...children];
    });
  }

  private _paragraphElementText(el: docs_v1.Schema$ParagraphElement): string {
    return el.textRun?.content ?? '';
  }

  private _parseElements(
    elements: docs_v1.Schema$StructuralElement[],
    opts: {
      elementTypes?: string[];
      namedStyles?: string[];
      fromIndex?: number;
      toIndex?: number;
      includeRuns: boolean;
    },
  ): ContentBlock[] {
    const blocks: ContentBlock[] = [];

    for (const el of elements) {
      const startIndex = el.startIndex ?? 0;
      const endIndex = el.endIndex ?? 0;

      // Index window filter — skip elements outside the requested range
      if (opts.fromIndex != null && endIndex <= opts.fromIndex) continue;
      if (opts.toIndex != null && startIndex >= opts.toIndex) continue;

      if (el.paragraph) {
        if (opts.elementTypes && !opts.elementTypes.includes('paragraph')) {
          continue;
        }

        const namedStyleType =
          el.paragraph.paragraphStyle?.namedStyleType ?? undefined;

        // namedStyles filter only applies to paragraphs; non-matching styles
        // are skipped while other element types pass through
        if (
          opts.namedStyles &&
          (!namedStyleType || !opts.namedStyles.includes(namedStyleType))
        ) {
          continue;
        }

        const runs: TextRun[] = (el.paragraph.elements ?? [])
          .filter((r) => r.startIndex != null && r.endIndex != null)
          .map((r) => ({
            startIndex: r.startIndex!,
            endIndex: r.endIndex!,
            text: this._paragraphElementText(r),
          }));

        const block: ParagraphBlock = {
          type: 'paragraph',
          startIndex,
          endIndex,
          text: runs.map((r) => r.text).join(''),
          namedStyleType,
        };
        if (opts.includeRuns) {
          block.runs = runs;
        }
        blocks.push(block);
      } else if (el.table) {
        if (opts.elementTypes && !opts.elementTypes.includes('table')) {
          continue;
        }
        const cells: TableCellBlock[] = [];
        for (const row of el.table.tableRows ?? []) {
          for (const cell of row.tableCells ?? []) {
            const cellText = (cell.content ?? [])
              .flatMap((ce) => ce.paragraph?.elements ?? [])
              .map((pe) => this._paragraphElementText(pe))
              .join('');
            cells.push({
              startIndex: cell.startIndex ?? 0,
              endIndex: cell.endIndex ?? 0,
              text: cellText,
            });
          }
        }
        blocks.push({
          type: 'table',
          startIndex,
          endIndex,
          rows: el.table.rows ?? 0,
          cols: el.table.columns ?? 0,
          cells,
        });
      } else if (el.tableOfContents) {
        if (
          opts.elementTypes &&
          !opts.elementTypes.includes('tableOfContents')
        ) {
          continue;
        }
        blocks.push({ type: 'tableOfContents', startIndex, endIndex });
      } else if (el.sectionBreak) {
        if (opts.elementTypes && !opts.elementTypes.includes('sectionBreak')) {
          continue;
        }
        blocks.push({ type: 'sectionBreak', startIndex, endIndex });
      }
    }

    return blocks;
  }

  /**
   * Return document structure with start/end indices for every element.
   * Supports filtering by element type, paragraph named style, index window,
   * and run inclusion to keep responses small for large documents.
   */
  public getStructure = async ({
    documentId,
    tabId,
    elementTypes,
    namedStyles,
    fromIndex,
    toIndex,
    includeRuns = true,
  }: {
    documentId: string;
    tabId?: string;
    elementTypes?: string[];
    namedStyles?: string[];
    fromIndex?: number;
    toIndex?: number;
    includeRuns?: boolean;
  }) => {
    logToFile(
      `[DocsEditService] getStructure for document: ${documentId}, tabId: ${tabId}`,
    );
    try {
      const id = extractDocId(documentId) || documentId;
      const docs = await this.getDocsClient();
      const res = await docs.documents.get({
        documentId: id,
        fields: 'documentId,title,tabs',
        includeTabsContent: true,
      });

      const allTabs = this._flattenTabs(res.data.tabs ?? []);
      const tabsToProcess = tabId
        ? allTabs.filter((t) => t.tabProperties?.tabId === tabId)
        : allTabs;

      if (tabId && tabsToProcess.length === 0) {
        throw new Error(`Tab with ID ${tabId} not found.`);
      }

      const opts = {
        elementTypes,
        namedStyles,
        fromIndex,
        toIndex,
        includeRuns,
      };

      const result = {
        documentId: res.data.documentId,
        title: res.data.title,
        tabs: tabsToProcess.map((tab) => ({
          tabId: tab.tabProperties?.tabId,
          title: tab.tabProperties?.title,
          elements: this._parseElements(
            tab.documentTab?.body?.content ?? [],
            opts,
          ),
        })),
      };

      const totalElements = result.tabs.reduce(
        (n, t) => n + t.elements.length,
        0,
      );
      logToFile(
        `[DocsEditService] getStructure returned ${totalElements} element(s) across ${result.tabs.length} tab(s)`,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(`[DocsEditService] Error in getStructure: ${errorMessage}`);
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
      };
    }
  };

  /**
   * Recursively collect all paragraphs from structural elements,
   * including those inside table cells. Returns each paragraph's
   * elements alongside the tabId it belongs to.
   */
  private _collectParagraphs(
    elements: docs_v1.Schema$StructuralElement[],
    tabId: string | undefined,
    tabTitle: string | undefined,
  ): Array<{
    elements: docs_v1.Schema$ParagraphElement[];
    tabId: string | undefined;
    tabTitle: string | undefined;
  }> {
    const out: Array<{
      elements: docs_v1.Schema$ParagraphElement[];
      tabId: string | undefined;
      tabTitle: string | undefined;
    }> = [];

    for (const el of elements) {
      if (el.paragraph?.elements) {
        out.push({ elements: el.paragraph.elements, tabId, tabTitle });
      } else if (el.table) {
        for (const row of el.table.tableRows ?? []) {
          for (const cell of row.tableCells ?? []) {
            out.push(
              ...this._collectParagraphs(cell.content ?? [], tabId, tabTitle),
            );
          }
        }
      }
    }

    return out;
  }

  /**
   * Find all occurrences of a search string within a document and return
   * their absolute start/end indices, sorted descending (end-of-document
   * first) so they can be safely passed to deleteRanges without index
   * adjustment.
   */
  public findTextRange = async ({
    documentId,
    text,
    tabId,
    caseSensitive = false,
  }: {
    documentId: string;
    text: string;
    tabId?: string;
    caseSensitive?: boolean;
  }) => {
    logToFile(
      `[DocsEditService] findTextRange "${text}" in document: ${documentId}`,
    );
    try {
      if (!text) {
        throw new Error('text must not be empty');
      }

      const id = extractDocId(documentId) || documentId;
      const docs = await this.getDocsClient();
      const res = await docs.documents.get({
        documentId: id,
        fields: 'documentId,title,tabs',
        includeTabsContent: true,
      });

      const allTabs = this._flattenTabs(res.data.tabs ?? []);
      const tabsToSearch = tabId
        ? allTabs.filter((t) => t.tabProperties?.tabId === tabId)
        : allTabs;

      if (tabId && tabsToSearch.length === 0) {
        throw new Error(`Tab with ID ${tabId} not found.`);
      }

      const needle = caseSensitive ? text : text.toLowerCase();
      const matches: TextMatch[] = [];

      for (const tab of tabsToSearch) {
        const tId = tab.tabProperties?.tabId ?? undefined;
        const tTitle = tab.tabProperties?.title ?? undefined;
        const paragraphs = this._collectParagraphs(
          tab.documentTab?.body?.content ?? [],
          tId,
          tTitle,
        );

        for (const para of paragraphs) {
          // Build a run map: for each run, track its char-offset within
          // the concatenated paragraph text and its absolute doc start.
          const runMap: Array<{ charStart: number; absStart: number }> = [];
          let paraText = '';

          for (const run of para.elements) {
            if (run.startIndex == null) continue;
            runMap.push({
              charStart: paraText.length,
              absStart: run.startIndex,
            });
            paraText += run.textRun?.content ?? '';
          }

          if (!paraText) continue;

          const haystack = caseSensitive ? paraText : paraText.toLowerCase();
          let pos = 0;

          while ((pos = haystack.indexOf(needle, pos)) !== -1) {
            // Map char offset within paragraph → absolute doc index
            let absStart = 0;
            for (let i = runMap.length - 1; i >= 0; i--) {
              if (runMap[i].charStart <= pos) {
                absStart = runMap[i].absStart + (pos - runMap[i].charStart);
                break;
              }
            }

            const absEnd = absStart + text.length;

            // Build context snippet (~30 chars either side)
            const ctxBefore = paraText.slice(Math.max(0, pos - 30), pos);
            const ctxAfter = paraText.slice(
              pos + text.length,
              pos + text.length + 30,
            );
            const context = `…${ctxBefore}[${paraText.slice(pos, pos + text.length)}]${ctxAfter}…`;

            matches.push({
              startIndex: absStart,
              endIndex: absEnd,
              context,
              tabId: tId,
              tabTitle: tTitle,
            });

            pos += text.length; // non-overlapping
          }
        }
      }

      // Sort descending: process from end of document so indices stay valid
      matches.sort((a, b) => b.startIndex - a.startIndex);

      logToFile(
        `[DocsEditService] findTextRange found ${matches.length} match(es)`,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                count: matches.length,
                note:
                  matches.length > 1
                    ? 'Matches are sorted end-of-document first. Pass the full matches array to deleteRanges to delete all occurrences safely.'
                    : undefined,
                matches,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(`[DocsEditService] Error in findTextRange: ${errorMessage}`);
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
      };
    }
  };

  /**
   * Delete a range of content from a Google Doc by start and end index.
   * Indices come from getStructure. The range is [startIndex, endIndex) —
   * endIndex is exclusive.
   *
   * To delete an entire paragraph (including its trailing newline), use
   * the paragraph's startIndex and endIndex directly.
   */
  public deleteRange = async ({
    documentId,
    startIndex,
    endIndex,
    tabId,
  }: {
    documentId: string;
    startIndex: number;
    endIndex: number;
    tabId?: string;
  }) => {
    logToFile(
      `[DocsEditService] deleteRange [${startIndex}, ${endIndex}) in document: ${documentId}`,
    );
    try {
      if (startIndex < 1) {
        throw new Error('startIndex must be >= 1');
      }
      if (endIndex <= startIndex) {
        throw new Error('endIndex must be > startIndex');
      }

      const id = extractDocId(documentId) || documentId;
      const docs = await this.getDocsClient();

      await docs.documents.batchUpdate({
        documentId: id,
        requestBody: {
          requests: [
            {
              deleteContentRange: {
                range: {
                  startIndex,
                  endIndex,
                  ...(tabId && { tabId }),
                },
              },
            },
          ],
        },
      });

      logToFile(`[DocsEditService] deleteRange succeeded for document: ${id}`);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              deletedRange: { startIndex, endIndex },
            }),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(`[DocsEditService] Error in deleteRange: ${errorMessage}`);
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
      };
    }
  };

  /**
   * Delete multiple content ranges from a Google Doc in a single operation.
   * Ranges are sorted end-of-document first internally, so indices from a
   * prior findTextRange call can be passed directly without adjustment.
   * Overlapping ranges are rejected.
   */
  public deleteRanges = async ({
    documentId,
    ranges,
  }: {
    documentId: string;
    ranges: IndexRange[];
  }) => {
    logToFile(
      `[DocsEditService] deleteRanges ${ranges.length} range(s) in document: ${documentId}`,
    );
    try {
      if (ranges.length === 0) {
        throw new Error('ranges must not be empty');
      }

      // Validate individual ranges
      for (const r of ranges) {
        if (r.startIndex < 1) {
          throw new Error(`startIndex ${r.startIndex} must be >= 1`);
        }
        if (r.endIndex <= r.startIndex) {
          throw new Error(
            `endIndex ${r.endIndex} must be > startIndex ${r.startIndex}`,
          );
        }
      }

      // Sort descending so later deletions don't shift earlier indices
      const sorted = [...ranges].sort((a, b) => b.startIndex - a.startIndex);

      // Detect overlaps after sorting
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1].endIndex > sorted[i].startIndex) {
          throw new Error(
            `Ranges [${sorted[i + 1].startIndex}, ${sorted[i + 1].endIndex}) and ` +
              `[${sorted[i].startIndex}, ${sorted[i].endIndex}) overlap. ` +
              `Resolve overlaps before calling deleteRanges.`,
          );
        }
      }

      const id = extractDocId(documentId) || documentId;
      const docs = await this.getDocsClient();

      await docs.documents.batchUpdate({
        documentId: id,
        requestBody: {
          requests: sorted.map((r) => ({
            deleteContentRange: {
              range: {
                startIndex: r.startIndex,
                endIndex: r.endIndex,
                ...(r.tabId && { tabId: r.tabId }),
              },
            },
          })),
        },
      });

      logToFile(
        `[DocsEditService] deleteRanges succeeded: ${sorted.length} range(s) deleted`,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              deletedCount: sorted.length,
              deletedRanges: sorted,
            }),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logToFile(`[DocsEditService] Error in deleteRanges: ${errorMessage}`);
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
      };
    }
  };
}
