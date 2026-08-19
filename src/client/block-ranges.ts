import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import type { Root, RootContent } from "mdast";
import { BLOCK_TYPES } from "./remark-position-plugin";

export interface BlockRange {
  startLine: number;
  endLine: number;
}

/**
 * Returns the start/end line ranges of every commentable block in the
 * given markdown content, using the same block types the renderer
 * makes commentable (see remark-position-plugin.ts).
 */
export function getBlockRanges(content: string): BlockRange[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(content) as Root;
  const ranges: BlockRange[] = [];

  visit(tree, (node: Root | RootContent) => {
    if (!BLOCK_TYPES.has(node.type)) return;
    if (!node.position) return;
    ranges.push({
      startLine: node.position.start.line,
      endLine: node.position.end.line,
    });
  });

  return ranges;
}

export function blockExists(
  ranges: BlockRange[],
  startLine: number,
  endLine: number,
): boolean {
  return ranges.some(
    (r) => r.startLine === startLine && r.endLine === endLine,
  );
}
