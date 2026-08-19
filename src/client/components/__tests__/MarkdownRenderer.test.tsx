import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarkdownRenderer } from "../MarkdownRenderer";
import type { Comment, ActiveCommentForm } from "../../types";

// Mock mermaid so jsdom doesn't choke on it
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: "<svg>mock</svg>" }),
  },
}));

const noopAdd = vi.fn();
const noopSubmit = vi.fn();
const noopCancel = vi.fn();
const noopEdit = vi.fn();
const noopDelete = vi.fn();
const noopToggleExpanded = vi.fn();

function renderMarkdown(
  content: string,
  options: {
    comments?: Comment[];
    activeForm?: ActiveCommentForm | null;
    expandedCommentIds?: Set<string>;
  } = {},
) {
  return render(
    <MarkdownRenderer
      content={content}
      comments={options.comments ?? []}
      activeForm={options.activeForm ?? null}
      expandedCommentIds={options.expandedCommentIds ?? new Set()}
      onAddComment={noopAdd}
      onCommentSubmit={noopSubmit}
      onCommentCancel={noopCancel}
      onEditComment={noopEdit}
      onDeleteComment={noopDelete}
      onToggleCommentExpanded={noopToggleExpanded}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MarkdownRenderer", () => {
  it("renders heading with data-start-line and data-end-line attributes", () => {
    renderMarkdown("# Hello World");

    const block = document.querySelector(".commentable-block");
    expect(block).not.toBeNull();
    expect(block!.getAttribute("data-start-line")).toBe("1");
    expect(block!.getAttribute("data-end-line")).toBe("1");
    expect(block!.getAttribute("data-block-type")).toBe("heading");
  });

  it("renders paragraph with correct line attributes", () => {
    const md = `# Title

This is a paragraph.`;
    renderMarkdown(md);

    const blocks = document.querySelectorAll(".commentable-block");
    // Should have heading block and paragraph block
    expect(blocks.length).toBeGreaterThanOrEqual(2);

    const paragraphBlock = Array.from(blocks).find(
      (b) => b.getAttribute("data-block-type") === "paragraph",
    );
    expect(paragraphBlock).not.toBeNull();
    expect(paragraphBlock!.getAttribute("data-start-line")).toBe("3");
    expect(paragraphBlock!.getAttribute("data-end-line")).toBe("3");
  });

  it("renders fenced code block with line range", () => {
    const md = `Some text

\`\`\`js
const x = 1;
const y = 2;
\`\`\``;
    renderMarkdown(md);

    const codeBlock = Array.from(
      document.querySelectorAll(".commentable-block"),
    ).find((b) => b.getAttribute("data-block-type") === "code");
    expect(codeBlock).not.toBeNull();
    expect(codeBlock!.getAttribute("data-start-line")).toBe("3");
    expect(codeBlock!.getAttribute("data-end-line")).toBe("6");
  });

  it("add-comment button exists on commentable blocks", () => {
    renderMarkdown("# Hello World");

    const btn = document.querySelector(".add-comment-btn");
    expect(btn).not.toBeNull();
  });

  it("clicking add-comment button calls onAddComment with correct arguments", async () => {
    const user = userEvent.setup();
    renderMarkdown("# Hello World");

    const btn = document.querySelector(".add-comment-btn") as HTMLElement;
    await user.click(btn);

    expect(noopAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        startLine: 1,
        endLine: 1,
        blockType: "heading",
      }),
    );
  });

  it("mermaid code block gets data-block-type mermaid and does not render as plain pre", () => {
    const md = `\`\`\`mermaid
graph TD
  A --> B
\`\`\``;
    renderMarkdown(md);

    const mermaidBlock = Array.from(
      document.querySelectorAll(".commentable-block"),
    ).find((b) => b.getAttribute("data-block-type") === "mermaid");
    expect(mermaidBlock).not.toBeNull();

    // Should NOT have a plain <pre> inside the mermaid block
    const preInside = mermaidBlock!.querySelector("pre");
    expect(preInside).toBeNull();
  });
});
