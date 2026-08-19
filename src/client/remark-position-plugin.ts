import { visit } from "unist-util-visit";
import type { Root, RootContent } from "mdast";

export const BLOCK_TYPES = new Set([
  "heading",
  "paragraph",
  "code",
  "blockquote",
  "list",
  "listItem",
  "table",
]);

/**
 * Remark plugin that annotates block-level AST nodes with
 * data-startLine and data-endLine hProperties. react-markdown passes
 * these through as HTML data attributes.
 */
export function remarkPositionPlugin() {
  return (tree: Root) => {
    visit(tree, (node: Root | RootContent) => {
      if (!BLOCK_TYPES.has(node.type)) return;
      if (!node.position) return;

      const data = (node.data ??= {});
      const hProperties = ((data as Record<string, unknown>).hProperties ??=
        {}) as Record<string, unknown>;

      hProperties["data-startline"] = node.position.start.line;
      hProperties["data-endline"] = node.position.end.line;
      hProperties["data-blocktype"] = node.type;
    });
  };
}
