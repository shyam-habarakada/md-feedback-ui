import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useReviewFiles } from "./hooks/useReviewFiles";
import { useComments } from "./hooks/useComments";
import { restoreReviewComments } from "./restore-review";
import { FileTabBar } from "./components/FileTabBar";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import { ReviewSidebar } from "./components/ReviewSidebar";
import type { ReviewSubmission } from "./types";
import "./styles/app.css";

export function App() {
  const { files, loading, error } = useReviewFiles();
  const [activeIndex, setActiveIndex] = useState(0);
  const {
    comments,
    activeForm,
    expandedCommentIds,
    getCommentsForFile,
    getCommentCount,
    showCommentForm,
    cancelComment,
    addComment,
    deleteComment,
    startEditing,
    restoreComments,
    expandComment,
    toggleCommentExpanded,
  } = useComments();

  const [submitted, setSubmitted] = useState(false);
  const [outputPath, setOutputPath] = useState<string | null>(null);

  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (files.length === 0 || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    restoreReviewComments(files).then((restored) => {
      if (restored.size > 0) restoreComments(restored);
    });
  }, [files, restoreComments]);

  const activeFile = files[activeIndex] ?? null;

  const totalComments = getCommentCount();
  const commentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of files) {
      counts.set(file.path, getCommentsForFile(file.path).length);
    }
    return counts;
  }, [files, getCommentsForFile]);

  const handleAddComment = useCallback(
    (block: {
      startLine: number;
      endLine: number;
      blockType: string;
      selectedText: string;
    }) => {
      if (!activeFile) return;
      showCommentForm({
        filePath: activeFile.path,
        startLine: block.startLine,
        endLine: block.endLine,
        blockType: block.blockType,
        selectedText: block.selectedText,
      });
    },
    [activeFile, showCommentForm],
  );

  const handleCommentSubmit = useCallback(
    (text: string, screenshots?: File[]) => {
      addComment(text, screenshots);
    },
    [addComment],
  );

  const handleCommentCancel = useCallback(() => {
    cancelComment();
  }, [cancelComment]);

  const handleEditComment = useCallback(
    (id: string) => {
      if (!activeFile) return;
      startEditing(activeFile.path, id);
    },
    [activeFile, startEditing],
  );

  const handleDeleteComment = useCallback(
    (id: string) => {
      if (!activeFile) return;
      deleteComment(activeFile.path, id);
    },
    [activeFile, deleteComment],
  );

  const handleScrollToComment = useCallback(
    (commentId: string) => {
      expandComment(commentId);
      // Defer to the next frame so the expand re-render has already
      // committed — otherwise scrollIntoView centers on the shorter,
      // still-collapsed card and the expanded content ends up off-center.
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    },
    [expandComment],
  );

  const handleSubmitReview = useCallback(async () => {
    // Build the submission payload
    const allComments: ReviewSubmission["comments"] = [];
    for (const file of files) {
      const fileComments = getCommentsForFile(file.path);
      for (const c of fileComments) {
        allComments.push({
          file: file.relativePath,
          startLine: c.startLine,
          endLine: c.endLine,
          blockType: c.blockType,
          selectedText: c.selectedText,
          comment: c.comment,
          screenshots: [], // will be filled with server paths after upload
        });
      }
    }

    const submission: ReviewSubmission = {
      reviewedFiles: files.map((f) => f.path),
      submittedAt: new Date().toISOString(),
      comments: allComments,
    };

    // Submit to server
    const formData = new FormData();
    formData.append("review", JSON.stringify(submission));

    // Attach screenshot files tagged by comment index
    let commentIndex = 0;
    for (const file of files) {
      const fileComments = getCommentsForFile(file.path);
      for (const c of fileComments) {
        for (const screenshot of c.screenshots) {
          formData.append(`screenshot_${commentIndex}`, screenshot);
        }
        commentIndex++;
      }
    }

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        setSubmitted(true);
        setOutputPath(result.outputPath);
      }
    } catch {
      // Server may have already shut down
      setSubmitted(true);
      setOutputPath("(server disconnected)");
    }
  }, [files, getCommentsForFile]);

  if (loading) {
    return <div className="loading">Loading plan files...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (files.length === 0) {
    return <div className="error">No files to review.</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Markdown Feedback</h1>
        <span className="comment-count">
          {totalComments} comment{totalComments !== 1 ? "s" : ""}
        </span>
      </header>

      {files.length > 1 && (
        <FileTabBar
          files={files}
          activeIndex={activeIndex}
          commentCounts={commentCounts}
          onTabChange={setActiveIndex}
        />
      )}

      <div className="app-body">
        <main className="content">
          {activeFile && (
            <MarkdownRenderer
              content={activeFile.content}
              comments={getCommentsForFile(activeFile.path)}
              activeForm={
                activeForm?.filePath === activeFile.path ? activeForm : null
              }
              expandedCommentIds={expandedCommentIds}
              onAddComment={handleAddComment}
              onCommentSubmit={handleCommentSubmit}
              onCommentCancel={handleCommentCancel}
              onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment}
              onToggleCommentExpanded={toggleCommentExpanded}
            />
          )}
        </main>

        <ReviewSidebar
          files={files}
          comments={comments}
          onScrollToComment={handleScrollToComment}
          onSubmit={handleSubmitReview}
          submitted={submitted}
          outputPath={outputPath}
        />
      </div>
    </div>
  );
}
