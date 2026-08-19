import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentThread } from "../CommentThread";
import type { Comment } from "../../types";

beforeEach(() => {
  URL.createObjectURL = vi.fn((f: File) => `blob:${f.name}`);
  URL.revokeObjectURL = vi.fn();
});

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "comment-1",
    filePath: "/root/README.md",
    startLine: 5,
    endLine: 8,
    blockType: "paragraph",
    selectedText: "Some selected text",
    comment: "This needs revision",
    screenshots: [],
    ...overrides,
  };
}

// CommentThread is a controlled component: expand/collapse state lives in
// the parent (useComments' expandedCommentIds). This wrapper stands in for
// that parent so tests can exercise the toggle interaction end to end.
function ControlledCommentThread({
  comment,
  initialExpanded = false,
  onEdit = vi.fn(),
  onDelete = vi.fn(),
}: {
  comment: Comment;
  initialExpanded?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(initialExpanded);
  return (
    <CommentThread
      comment={comment}
      expanded={expanded}
      onToggleExpanded={() => setExpanded((e) => !e)}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

describe("CommentThread", () => {
  it("renders collapsed when expanded=false, showing a truncated summary", () => {
    render(
      <CommentThread
        comment={makeComment()}
        expanded={false}
        onToggleExpanded={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("This needs revision")).toBeInTheDocument();
    expect(
      document.querySelector(".comment-thread--collapsed"),
    ).toBeInTheDocument();
    expect(document.querySelector(".comment-thread__quote")).not.toBeInTheDocument();
    expect(screen.getByText("Expand")).toBeInTheDocument();
  });

  it("renders expanded when expanded=true, showing the full quote and actions", () => {
    render(
      <CommentThread
        comment={makeComment({ selectedText: "The quoted block" })}
        expanded={true}
        onToggleExpanded={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(
      document.querySelector(".comment-thread--collapsed"),
    ).not.toBeInTheDocument();
    const quote = document.querySelector(".comment-thread__quote");
    expect(quote).toBeInTheDocument();
    expect(quote!.textContent).toBe("The quoted block");
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Collapse")).toBeInTheDocument();
  });

  it("truncates a long comment in the collapsed summary", () => {
    const longComment = "x".repeat(120);
    render(
      <CommentThread
        comment={makeComment({ comment: longComment })}
        expanded={false}
        onToggleExpanded={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const summary = document.querySelector(".comment-thread__summary-text");
    expect(summary).toBeInTheDocument();
    expect(summary!.textContent).toHaveLength(83); // 80 chars + "..."
    expect(summary!.textContent!.endsWith("...")).toBe(true);
  });

  it("clicking the toggle calls onToggleExpanded", async () => {
    const onToggleExpanded = vi.fn();
    const user = userEvent.setup();
    render(
      <CommentThread
        comment={makeComment()}
        expanded={false}
        onToggleExpanded={onToggleExpanded}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Expand"));
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
  });

  it("toggles between collapsed and expanded when driven by a stateful parent", async () => {
    const user = userEvent.setup();
    render(<ControlledCommentThread comment={makeComment()} />);

    expect(document.querySelector(".comment-thread__quote")).not.toBeInTheDocument();

    await user.click(screen.getByText("Expand"));
    expect(document.querySelector(".comment-thread__quote")).toBeInTheDocument();

    await user.click(screen.getByText("Collapse"));
    expect(document.querySelector(".comment-thread__quote")).not.toBeInTheDocument();
    expect(screen.getByText("Expand")).toBeInTheDocument();
  });

  it("keeps the toggle button in the header row in both collapsed and expanded states", async () => {
    const user = userEvent.setup();
    render(<ControlledCommentThread comment={makeComment()} />);

    const header = document.querySelector(".comment-thread__header");
    expect(header).toBeInTheDocument();
    expect(header!.querySelector(".comment-thread__toggle")).toHaveTextContent(
      "Expand",
    );

    await user.click(screen.getByText("Expand"));

    const headerAfterExpand = document.querySelector(".comment-thread__header");
    expect(headerAfterExpand).toBeInTheDocument();
    expect(
      headerAfterExpand!.querySelector(".comment-thread__toggle"),
    ).toHaveTextContent("Collapse");
    // Edit/Delete stay out of the header — only the toggle lives there.
    expect(headerAfterExpand!.textContent).not.toContain("Edit");
    expect(headerAfterExpand!.textContent).not.toContain("Delete");
  });

  it('renders line range badge "Lines 5-8"', () => {
    render(
      <CommentThread
        comment={makeComment({ startLine: 5, endLine: 8 })}
        expanded={false}
        onToggleExpanded={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Lines 5-8")).toBeInTheDocument();
  });

  it("clicking Edit calls onEdit with comment id", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();

    render(
      <ControlledCommentThread
        comment={makeComment({ id: "abc-123" })}
        initialExpanded={true}
        onEdit={onEdit}
      />,
    );

    await user.click(screen.getByText("Edit"));
    expect(onEdit).toHaveBeenCalledWith("abc-123");
  });

  it("clicking Delete calls onDelete with comment id", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();

    render(
      <ControlledCommentThread
        comment={makeComment({ id: "abc-123" })}
        initialExpanded={true}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("abc-123");
  });

  it("has data-comment-id attribute matching comment.id", () => {
    render(
      <CommentThread
        comment={makeComment({ id: "thread-42" })}
        expanded={false}
        onToggleExpanded={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const thread = document.querySelector(".comment-thread");
    expect(thread).toHaveAttribute("data-comment-id", "thread-42");
  });

  it('renders "Line 5" for single-line comment', () => {
    render(
      <CommentThread
        comment={makeComment({ startLine: 5, endLine: 5 })}
        expanded={false}
        onToggleExpanded={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Line 5")).toBeInTheDocument();
  });

  it("revokes ObjectURLs on unmount when screenshots are present", () => {
    const screenshots = [
      new File(["a"], "a.png", { type: "image/png" }),
      new File(["b"], "b.png", { type: "image/png" }),
    ];

    const { unmount } = render(
      <CommentThread
        comment={makeComment({ screenshots })}
        expanded={false}
        onToggleExpanded={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:a.png");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:b.png");
  });
});
