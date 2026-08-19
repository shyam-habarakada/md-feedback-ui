import { createElement, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Comment, ActiveCommentForm } from "../types";
import { remarkPositionPlugin } from "../remark-position-plugin";
import {
  CommentableBlock,
  CommentableBlockContext,
  type CommentableBlockContextValue,
} from "./CommentableBlock";
import { MermaidBlock } from "./MermaidBlock";

interface MarkdownRendererProps {
  content: string;
  comments: Comment[];
  activeForm: ActiveCommentForm | null;
  expandedCommentIds: Set<string>;
  onAddComment: (block: {
    startLine: number;
    endLine: number;
    blockType: string;
    selectedText: string;
  }) => void;
  onCommentSubmit: (text: string, screenshots?: File[]) => void;
  onCommentCancel: () => void;
  onEditComment: (id: string) => void;
  onDeleteComment: (id: string) => void;
  onToggleCommentExpanded: (id: string) => void;
}

function extractText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractText(
      (children as { props: { children?: ReactNode } }).props.children,
    );
  }
  return "";
}

function stripDataProps(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (
      !key.startsWith("data-startline") &&
      !key.startsWith("data-endline") &&
      !key.startsWith("data-blocktype") &&
      key !== "node"
    ) {
      result[key] = value;
    }
  }
  return result;
}

function makeBlockComponent(tag: string, blockTypeOverride: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function BlockComponent(props: any) {
    const startLine = Number(props["data-startline"]) || 0;
    const endLine = Number(props["data-endline"]) || 0;
    const blockType =
      blockTypeOverride ?? (props["data-blocktype"] as string) ?? tag;

    if (!startLine) {
      return createElement(tag, stripDataProps(props));
    }

    return (
      <CommentableBlock
        startLine={startLine}
        endLine={endLine}
        blockType={blockType}
        selectedText={extractText(props.children)}
      >
        {createElement(tag, stripDataProps(props))}
      </CommentableBlock>
    );
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PreComponent(props: any) {
  const child = Array.isArray(props.children)
    ? props.children[0]
    : props.children;

  const childProps = child?.props ?? {};
  const startLine =
    Number(props["data-startline"]) ||
    Number(childProps["data-startline"]) ||
    0;
  const endLine =
    Number(props["data-endline"]) ||
    Number(childProps["data-endline"]) ||
    0;
  const blockType =
    (props["data-blocktype"] as string) ??
    (childProps["data-blocktype"] as string) ??
    "code";

  const isMermaid =
    childProps.className === "language-mermaid" ||
    childProps.className?.includes("language-mermaid");

  if (isMermaid && startLine) {
    const mermaidCode = extractText(childProps.children);
    return (
      <CommentableBlock
        startLine={startLine}
        endLine={endLine}
        blockType="mermaid"
        selectedText={mermaidCode}
      >
        <MermaidBlock code={mermaidCode} />
      </CommentableBlock>
    );
  }

  if (!startLine) {
    return <pre {...stripDataProps(props)} />;
  }

  return (
    <CommentableBlock
      startLine={startLine}
      endLine={endLine}
      blockType={blockType}
      selectedText={extractText(props.children)}
    >
      <pre {...stripDataProps(props)} />
    </CommentableBlock>
  );
}

const components = {
  h1: makeBlockComponent("h1", "heading"),
  h2: makeBlockComponent("h2", "heading"),
  h3: makeBlockComponent("h3", "heading"),
  h4: makeBlockComponent("h4", "heading"),
  h5: makeBlockComponent("h5", "heading"),
  h6: makeBlockComponent("h6", "heading"),
  p: makeBlockComponent("p", "paragraph"),
  blockquote: makeBlockComponent("blockquote", "blockquote"),
  table: makeBlockComponent("table", "table"),
  li: makeBlockComponent("li", "listItem"),
  pre: PreComponent,
};

export function MarkdownRenderer({
  content,
  comments,
  activeForm,
  expandedCommentIds,
  onAddComment,
  onCommentSubmit,
  onCommentCancel,
  onEditComment,
  onDeleteComment,
  onToggleCommentExpanded,
}: MarkdownRendererProps) {
  const ctxValue: CommentableBlockContextValue = useMemo(
    () => ({
      comments,
      activeForm,
      expandedCommentIds,
      onAddComment,
      onCommentSubmit,
      onCommentCancel,
      onEditComment,
      onDeleteComment,
      onToggleCommentExpanded,
    }),
    [
      comments,
      activeForm,
      expandedCommentIds,
      onAddComment,
      onCommentSubmit,
      onCommentCancel,
      onEditComment,
      onDeleteComment,
      onToggleCommentExpanded,
    ],
  );

  return (
    <div className="markdown-renderer">
      <CommentableBlockContext.Provider value={ctxValue}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkPositionPlugin]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </CommentableBlockContext.Provider>
    </div>
  );
}
