import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentableBlock, CommentableBlockContext } from "../CommentableBlock";
import type { Comment, ActiveCommentForm } from "../../types";

beforeEach(() => {
  URL.createObjectURL = vi.fn((f: File) => `blob:${f.name}`);
  URL.revokeObjectURL = vi.fn();
});

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "c1",
    filePath: "file.md",
    startLine: 5,
    endLine: 8,
    blockType: "paragraph",
    selectedText: "some text",
    comment: "A comment",
    screenshots: [],
    ...overrides,
  };
}

const defaultCtx = {
  comments: [] as Comment[],
  activeForm: null as ActiveCommentForm | null,
  expandedCommentIds: new Set<string>(),
  onAddComment: vi.fn(),
  onCommentSubmit: vi.fn(),
  onCommentCancel: vi.fn(),
  onEditComment: vi.fn(),
  onDeleteComment: vi.fn(),
  onToggleCommentExpanded: vi.fn(),
};

function renderBlock(
  ctxOverrides: Partial<typeof defaultCtx> = {},
  props: Partial<{
    startLine: number;
    endLine: number;
    blockType: string;
    selectedText: string;
  }> = {},
) {
  const ctx = { ...defaultCtx, ...ctxOverrides };
  return render(
    <CommentableBlockContext.Provider value={ctx}>
      <CommentableBlock
        startLine={props.startLine ?? 5}
        endLine={props.endLine ?? 8}
        blockType={props.blockType ?? "paragraph"}
        selectedText={props.selectedText ?? "some text"}
      >
        <p>Child content</p>
      </CommentableBlock>
    </CommentableBlockContext.Provider>,
  );
}

describe("CommentableBlock", () => {
  it("renders children content", () => {
    renderBlock();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("shows + button that calls onAddComment with correct block info", async () => {
    const onAddComment = vi.fn();
    const user = userEvent.setup();

    renderBlock({ onAddComment });

    await user.click(screen.getByText("+"));
    expect(onAddComment).toHaveBeenCalledWith({
      startLine: 5,
      endLine: 8,
      blockType: "paragraph",
      selectedText: "some text",
    });
  });

  it("renders CommentThread for comments matching this block's line range", () => {
    const comments = [makeComment({ startLine: 5, endLine: 8 })];
    renderBlock({ comments });

    expect(screen.getByText("A comment")).toBeInTheDocument();
  });

  it("does not render comments for non-matching line ranges", () => {
    const comments = [makeComment({ startLine: 1, endLine: 2 })];
    renderBlock({ comments });

    expect(screen.queryByText("A comment")).not.toBeInTheDocument();
  });

  it("shows CommentForm when activeForm matches this block's lines", () => {
    const activeForm: ActiveCommentForm = {
      filePath: "file.md",
      startLine: 5,
      endLine: 8,
      blockType: "paragraph",
      selectedText: "some text",
    };
    renderBlock({ activeForm });

    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("expands a matching CommentThread when its id is in expandedCommentIds", () => {
    const comments = [
      makeComment({ id: "c1", selectedText: "The quote", comment: "A comment" }),
    ];
    renderBlock({ comments, expandedCommentIds: new Set(["c1"]) });

    expect(screen.getByText("The quote")).toBeInTheDocument();
    expect(screen.getByText("Collapse")).toBeInTheDocument();
  });

  it("clicking the toggle calls onToggleCommentExpanded with the comment id", async () => {
    const onToggleCommentExpanded = vi.fn();
    const user = userEvent.setup();
    const comments = [makeComment({ id: "c1" })];
    renderBlock({ comments, onToggleCommentExpanded });

    await user.click(screen.getByText("Expand"));
    expect(onToggleCommentExpanded).toHaveBeenCalledWith("c1");
  });

  it("replaces CommentThread with CommentForm when editing that comment", () => {
    const comments = [
      makeComment({ id: "edit-me", comment: "Original text" }),
    ];
    const activeForm: ActiveCommentForm = {
      filePath: "file.md",
      startLine: 5,
      endLine: 8,
      blockType: "paragraph",
      selectedText: "some text",
      editingId: "edit-me",
      editingText: "Original text",
    };
    renderBlock({ comments, activeForm });

    // CommentThread should be replaced by CommentForm
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Original text");
  });
});
