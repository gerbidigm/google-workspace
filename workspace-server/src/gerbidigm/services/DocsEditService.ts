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
  runs: TextRun[];
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
  ): ContentBlock[] {
    const blocks: ContentBlock[] = [];

    for (const el of elements) {
      const startIndex = el.startIndex ?? 0;
      const endIndex = el.endIndex ?? 0;

      if (el.paragraph) {
        const runs: TextRun[] = (el.paragraph.elements ?? [])
          .filter((r) => r.startIndex != null && r.endIndex != null)
          .map((r) => ({
            startIndex: r.startIndex!,
            endIndex: r.endIndex!,
            text: this._paragraphElementText(r),
          }));

        blocks.push({
          type: 'paragraph',
          startIndex,
          endIndex,
          text: runs.map((r) => r.text).join(''),
          runs,
        });
      } else if (el.table) {
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
        blocks.push({ type: 'tableOfContents', startIndex, endIndex });
      } else if (el.sectionBreak) {
        blocks.push({ type: 'sectionBreak', startIndex, endIndex });
      }
    }

    return blocks;
  }

  /**
   * Return document structure with start/end indices for every element.
   * Use this before deleteRange or other index-based edits so you know
   * which indices to target.
   */
  public getStructure = async ({
    documentId,
    tabId,
  }: {
    documentId: string;
    tabId?: string;
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

      const result = {
        documentId: res.data.documentId,
        title: res.data.title,
        tabs: tabsToProcess.map((tab) => ({
          tabId: tab.tabProperties?.tabId,
          title: tab.tabProperties?.title,
          elements: this._parseElements(tab.documentTab?.body?.content ?? []),
        })),
      };

      logToFile(
        `[DocsEditService] getStructure returned ${result.tabs.length} tab(s)`,
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
}
