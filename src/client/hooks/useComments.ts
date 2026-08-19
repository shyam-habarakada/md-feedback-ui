import { useCallback, useState } from "react";
import type { ActiveCommentForm, Comment } from "../types";

export function useComments(): {
  comments: Map<string, Comment[]>;
  activeForm: ActiveCommentForm | null;
  expandedCommentIds: Set<string>;
  getCommentsForFile: (filePath: string) => Comment[];
  getCommentCount: () => number;
  showCommentForm: (form: Omit<ActiveCommentForm, "editingId">) => void;
  cancelComment: () => void;
  addComment: (text: string, screenshots?: File[]) => void;
  deleteComment: (filePath: string, id: string) => void;
  startEditing: (filePath: string, id: string) => void;
  restoreComments: (restored: Map<string, Comment[]>) => void;
  expandComment: (id: string) => void;
  collapseComment: (id: string) => void;
  toggleCommentExpanded: (id: string) => void;
} {
  const [comments, setComments] = useState<Map<string, Comment[]>>(new Map());
  const [activeForm, setActiveForm] = useState<ActiveCommentForm | null>(null);
  const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(
    new Set(),
  );

  const expandComment = useCallback((id: string) => {
    setExpandedCommentIds((prev) => {
      if (prev.has(id)) return prev;
      return new Set(prev).add(id);
    });
  }, []);

  const collapseComment = useCallback((id: string) => {
    setExpandedCommentIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleCommentExpanded = useCallback((id: string) => {
    setExpandedCommentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const getCommentsForFile = useCallback(
    (filePath: string): Comment[] => {
      return comments.get(filePath) ?? [];
    },
    [comments],
  );

  const getCommentCount = useCallback((): number => {
    let count = 0;
    for (const fileComments of comments.values()) {
      count += fileComments.length;
    }
    return count;
  }, [comments]);

  const showCommentForm = useCallback(
    (form: Omit<ActiveCommentForm, "editingId">) => {
      setActiveForm(form);
    },
    [],
  );

  const cancelComment = useCallback(() => {
    if (activeForm?.editingId) {
      collapseComment(activeForm.editingId);
    }
    setActiveForm(null);
  }, [activeForm, collapseComment]);

  const addComment = useCallback(
    (text: string, screenshots?: File[]) => {
      if (!activeForm) return;

      if (activeForm.editingId) {
        setComments((prev) => {
          const next = new Map(prev);
          const fileComments = next.get(activeForm.filePath) ?? [];
          next.set(
            activeForm.filePath,
            fileComments.map((c) =>
              c.id === activeForm.editingId
                ? { ...c, comment: text, screenshots: screenshots ?? c.screenshots }
                : c,
            ),
          );
          return next;
        });
        // A saved comment always collapses, whether it was expanded before
        // the edit began or not.
        collapseComment(activeForm.editingId);
      } else {
        const newComment: Comment = {
          id: crypto.randomUUID(),
          filePath: activeForm.filePath,
          startLine: activeForm.startLine,
          endLine: activeForm.endLine,
          blockType: activeForm.blockType,
          selectedText: activeForm.selectedText,
          comment: text,
          screenshots: screenshots ?? [],
        };

        setComments((prev) => {
          const next = new Map(prev);
          const existing = next.get(activeForm.filePath) ?? [];
          next.set(activeForm.filePath, [...existing, newComment]);
          return next;
        });
      }

      setActiveForm(null);
    },
    [activeForm, collapseComment],
  );

  const deleteComment = useCallback(
    (filePath: string, id: string) => {
      setComments((prev) => {
        const next = new Map(prev);
        const fileComments = next.get(filePath);
        if (fileComments) {
          const filtered = fileComments.filter((c) => c.id !== id);
          if (filtered.length === 0) {
            next.delete(filePath);
          } else {
            next.set(filePath, filtered);
          }
        }
        return next;
      });
      collapseComment(id);
    },
    [collapseComment],
  );

  const restoreComments = useCallback((restored: Map<string, Comment[]>) => {
    setComments((prev) => {
      const next = new Map(prev);
      for (const [filePath, restoredList] of restored) {
        const existing = next.get(filePath) ?? [];
        next.set(filePath, [...existing, ...restoredList]);
      }
      return next;
    });
  }, []);

  const startEditing = useCallback(
    (filePath: string, id: string) => {
      const fileComments = comments.get(filePath) ?? [];
      const comment = fileComments.find((c) => c.id === id);
      if (!comment) return;

      setActiveForm({
        filePath: comment.filePath,
        startLine: comment.startLine,
        endLine: comment.endLine,
        blockType: comment.blockType,
        selectedText: comment.selectedText,
        editingId: comment.id,
        editingText: comment.comment,
        editingScreenshots: comment.screenshots,
      });
    },
    [comments],
  );

  return {
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
    collapseComment,
    toggleCommentExpanded,
  };
}
