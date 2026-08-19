import { createContext, useContext, type ReactNode } from "react";
import type { Comment, ActiveCommentForm } from "../types";
import { CommentForm } from "./CommentForm";
import { CommentThread } from "./CommentThread";

export interface CommentableBlockContextValue {
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

export const CommentableBlockContext =
  createContext<CommentableBlockContextValue | null>(null);

interface CommentableBlockProps {
  startLine: number;
  endLine: number;
  blockType: string;
  selectedText: string;
  children: ReactNode;
}

export function CommentableBlock({
  startLine,
  endLine,
  blockType,
  selectedText,
  children,
}: CommentableBlockProps) {
  const ctx = useContext(CommentableBlockContext);
  if (!ctx) throw new Error("CommentableBlock requires CommentableBlockContext");

  const {
    comments,
    activeForm,
    expandedCommentIds,
    onAddComment,
    onCommentSubmit,
    onCommentCancel,
    onEditComment,
    onDeleteComment,
    onToggleCommentExpanded,
  } = ctx;

  const matchingComments = comments.filter(
    (c) => c.startLine === startLine && c.endLine === endLine,
  );

  const formActive =
    activeForm &&
    activeForm.startLine === startLine &&
    activeForm.endLine === endLine;

  return (
    <div
      className="commentable-block"
      data-start-line={startLine}
      data-end-line={endLine}
      data-block-type={blockType}
    >
      <button
        className="add-comment-btn"
        onClick={() =>
          onAddComment({ startLine, endLine, blockType, selectedText })
        }
      >
        +
      </button>
      {children}
      {matchingComments.map((comment) => {
        if (activeForm?.editingId === comment.id) {
          return (
            <CommentForm
              key={comment.id}
              startLine={startLine}
              endLine={endLine}
              onSubmit={onCommentSubmit}
              onCancel={onCommentCancel}
              initialText={activeForm.editingText}
              initialScreenshots={activeForm.editingScreenshots}
            />
          );
        }
        return (
          <CommentThread
            key={comment.id}
            comment={comment}
            expanded={expandedCommentIds.has(comment.id)}
            onToggleExpanded={() => onToggleCommentExpanded(comment.id)}
            onEdit={onEditComment}
            onDelete={onDeleteComment}
          />
        );
      })}
      {formActive && !activeForm?.editingId && (
        <CommentForm
          startLine={startLine}
          endLine={endLine}
          onSubmit={onCommentSubmit}
          onCancel={onCommentCancel}
        />
      )}
    </div>
  );
}
