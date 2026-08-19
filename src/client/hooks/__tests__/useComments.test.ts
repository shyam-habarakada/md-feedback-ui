import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useComments } from "../useComments";

describe("useComments", () => {
  const formA = {
    filePath: "fileA.md",
    startLine: 1,
    endLine: 3,
    blockType: "paragraph",
    selectedText: "some text",
  };

  const formB = {
    filePath: "fileB.md",
    startLine: 10,
    endLine: 12,
    blockType: "code",
    selectedText: "code block",
  };

  it("showCommentForm sets activeForm", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.showCommentForm(formA);
    });

    expect(result.current.activeForm).toEqual(formA);
  });

  it("cancelComment clears activeForm to null", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.showCommentForm(formA);
    });
    expect(result.current.activeForm).not.toBeNull();

    act(() => {
      result.current.cancelComment();
    });
    expect(result.current.activeForm).toBeNull();
  });

  it("addComment creates comment with id and correct fields", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.showCommentForm(formA);
    });

    act(() => {
      result.current.addComment("Great section!");
    });

    const comments = result.current.getCommentsForFile("fileA.md");
    expect(comments).toHaveLength(1);

    const comment = comments[0];
    expect(comment.id).toBeTruthy();
    expect(comment.filePath).toBe("fileA.md");
    expect(comment.startLine).toBe(1);
    expect(comment.endLine).toBe(3);
    expect(comment.blockType).toBe("paragraph");
    expect(comment.selectedText).toBe("some text");
    expect(comment.comment).toBe("Great section!");
    expect(comment.screenshots).toEqual([]);
  });

  it("addComment clears activeForm", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("A comment");
    });

    expect(result.current.activeForm).toBeNull();
  });

  it("addComment with screenshots attaches them", () => {
    const { result } = renderHook(() => useComments());
    const fakeFile = new File(["img"], "screenshot.png", {
      type: "image/png",
    });

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("With image", [fakeFile]);
    });

    const comments = result.current.getCommentsForFile("fileA.md");
    expect(comments[0].screenshots).toHaveLength(1);
    expect(comments[0].screenshots[0].name).toBe("screenshot.png");
  });

  it("deleteComment removes by id, leaves others intact", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("First");
    });
    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("Second");
    });

    const before = result.current.getCommentsForFile("fileA.md");
    expect(before).toHaveLength(2);
    const idToDelete = before[0].id;

    act(() => {
      result.current.deleteComment("fileA.md", idToDelete);
    });

    const after = result.current.getCommentsForFile("fileA.md");
    expect(after).toHaveLength(1);
    expect(after[0].comment).toBe("Second");
  });

  it("comments keyed by filePath - adding to file A does not affect file B", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("Comment on A");
    });
    act(() => {
      result.current.showCommentForm(formB);
    });
    act(() => {
      result.current.addComment("Comment on B");
    });

    expect(result.current.getCommentsForFile("fileA.md")).toHaveLength(1);
    expect(result.current.getCommentsForFile("fileB.md")).toHaveLength(1);
    expect(result.current.getCommentsForFile("fileA.md")[0].comment).toBe(
      "Comment on A",
    );
    expect(result.current.getCommentsForFile("fileB.md")[0].comment).toBe(
      "Comment on B",
    );
  });

  it("getCommentsForFile returns only that file's comments", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("A1");
    });
    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("A2");
    });
    act(() => {
      result.current.showCommentForm(formB);
    });
    act(() => {
      result.current.addComment("B1");
    });

    const fileAComments = result.current.getCommentsForFile("fileA.md");
    expect(fileAComments).toHaveLength(2);
    expect(fileAComments.every((c) => c.filePath === "fileA.md")).toBe(true);
  });

  it("getCommentCount returns total across all files", () => {
    const { result } = renderHook(() => useComments());

    expect(result.current.getCommentCount()).toBe(0);

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("A1");
    });
    act(() => {
      result.current.showCommentForm(formB);
    });
    act(() => {
      result.current.addComment("B1");
    });

    expect(result.current.getCommentCount()).toBe(2);
  });

  it("getCommentsForFile returns empty array for unknown file", () => {
    const { result } = renderHook(() => useComments());
    expect(result.current.getCommentsForFile("nonexistent.md")).toEqual([]);
  });

  it("startEditing sets activeForm with editingId", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("To edit");
    });

    const comment = result.current.getCommentsForFile("fileA.md")[0];

    act(() => {
      result.current.startEditing("fileA.md", comment.id);
    });

    expect(result.current.activeForm).toEqual({
      filePath: "fileA.md",
      startLine: 1,
      endLine: 3,
      blockType: "paragraph",
      selectedText: "some text",
      editingId: comment.id,
      editingText: "To edit",
      editingScreenshots: [],
    });
  });

  it("addComment when activeForm has editingId updates instead of creating", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("Original");
    });

    const comment = result.current.getCommentsForFile("fileA.md")[0];

    act(() => {
      result.current.startEditing("fileA.md", comment.id);
    });
    act(() => {
      result.current.addComment("Edited via form");
    });

    const comments = result.current.getCommentsForFile("fileA.md");
    expect(comments).toHaveLength(1);
    expect(comments[0].comment).toBe("Edited via form");
    expect(comments[0].id).toBe(comment.id);
    expect(result.current.activeForm).toBeNull();
  });

  it("addComment in edit mode updates screenshots as well as text", () => {
    const { result } = renderHook(() => useComments());

    const origScreenshot = new File(["a"], "orig.png", { type: "image/png" });

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("With screenshot", [origScreenshot]);
    });

    const comment = result.current.getCommentsForFile("fileA.md")[0];
    expect(comment.screenshots).toHaveLength(1);

    // Edit and add a new screenshot
    const newScreenshot = new File(["b"], "new.png", { type: "image/png" });
    act(() => {
      result.current.startEditing("fileA.md", comment.id);
    });
    act(() => {
      result.current.addComment("Updated text", [newScreenshot]);
    });

    const updated = result.current.getCommentsForFile("fileA.md")[0];
    expect(updated.comment).toBe("Updated text");
    expect(updated.screenshots).toHaveLength(1);
    expect(updated.screenshots[0].name).toBe("new.png");
  });

  it("startEditing captures existing screenshots in activeForm", () => {
    const { result } = renderHook(() => useComments());

    const screenshot = new File(["a"], "test.png", { type: "image/png" });

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("With screenshot", [screenshot]);
    });

    const comment = result.current.getCommentsForFile("fileA.md")[0];

    act(() => {
      result.current.startEditing("fileA.md", comment.id);
    });

    expect(result.current.activeForm?.editingScreenshots).toHaveLength(1);
    expect(result.current.activeForm?.editingScreenshots?.[0].name).toBe(
      "test.png",
    );
  });

  it("a newly added comment starts out not expanded", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("Fresh comment");
    });

    const comment = result.current.getCommentsForFile("fileA.md")[0];
    expect(result.current.expandedCommentIds.has(comment.id)).toBe(false);
  });

  it("expandComment adds the id to expandedCommentIds", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.expandComment("some-id");
    });

    expect(result.current.expandedCommentIds.has("some-id")).toBe(true);
  });

  it("toggleCommentExpanded flips membership in expandedCommentIds", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.toggleCommentExpanded("some-id");
    });
    expect(result.current.expandedCommentIds.has("some-id")).toBe(true);

    act(() => {
      result.current.toggleCommentExpanded("some-id");
    });
    expect(result.current.expandedCommentIds.has("some-id")).toBe(false);
  });

  it("saving an edit collapses the comment even if it was expanded beforehand", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("Original");
    });

    const comment = result.current.getCommentsForFile("fileA.md")[0];

    act(() => {
      result.current.expandComment(comment.id);
    });
    expect(result.current.expandedCommentIds.has(comment.id)).toBe(true);

    act(() => {
      result.current.startEditing("fileA.md", comment.id);
    });
    act(() => {
      result.current.addComment("Edited");
    });

    expect(result.current.expandedCommentIds.has(comment.id)).toBe(false);
  });

  it("canceling an edit collapses the comment being edited", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("Original");
    });

    const comment = result.current.getCommentsForFile("fileA.md")[0];

    act(() => {
      result.current.expandComment(comment.id);
    });
    act(() => {
      result.current.startEditing("fileA.md", comment.id);
    });
    act(() => {
      result.current.cancelComment();
    });

    expect(result.current.expandedCommentIds.has(comment.id)).toBe(false);
  });

  it("restoreComments merges restored comments into an empty state", () => {
    const { result } = renderHook(() => useComments());

    const restored = new Map([
      [
        "fileA.md",
        [
          {
            id: "restored-1",
            filePath: "fileA.md",
            startLine: 1,
            endLine: 1,
            blockType: "heading",
            selectedText: "Title",
            comment: "Restored comment",
            screenshots: [],
          },
        ],
      ],
    ]);

    act(() => {
      result.current.restoreComments(restored);
    });

    const comments = result.current.getCommentsForFile("fileA.md");
    expect(comments).toHaveLength(1);
    expect(comments[0].comment).toBe("Restored comment");
    expect(result.current.getCommentCount()).toBe(1);
  });

  it("restoreComments appends to, rather than replaces, existing comments for a file", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("Live comment");
    });

    const restored = new Map([
      [
        "fileA.md",
        [
          {
            id: "restored-1",
            filePath: "fileA.md",
            startLine: 10,
            endLine: 10,
            blockType: "paragraph",
            selectedText: "Other block",
            comment: "Restored comment",
            screenshots: [],
          },
        ],
      ],
    ]);

    act(() => {
      result.current.restoreComments(restored);
    });

    const comments = result.current.getCommentsForFile("fileA.md");
    expect(comments).toHaveLength(2);
    expect(comments.map((c) => c.comment)).toEqual([
      "Live comment",
      "Restored comment",
    ]);
  });

  it("deleteComment removes the id from expandedCommentIds", () => {
    const { result } = renderHook(() => useComments());

    act(() => {
      result.current.showCommentForm(formA);
    });
    act(() => {
      result.current.addComment("Original");
    });

    const comment = result.current.getCommentsForFile("fileA.md")[0];

    act(() => {
      result.current.expandComment(comment.id);
    });
    act(() => {
      result.current.deleteComment("fileA.md", comment.id);
    });

    expect(result.current.expandedCommentIds.has(comment.id)).toBe(false);
  });
});
