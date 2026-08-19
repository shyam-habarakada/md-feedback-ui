import { useMemo, useEffect } from "react";
import type { Comment } from "../types";
import { formatLineLabel } from "../format-line-label";

interface CommentThreadProps {
  comment: Comment;
  expanded: boolean;
  onToggleExpanded: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const SUMMARY_MAX_LENGTH = 80;

function summarize(text: string, maxLength: number): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength).trimEnd()}...`;
}

export function CommentThread({
  comment,
  expanded,
  onToggleExpanded,
  onEdit,
  onDelete,
}: CommentThreadProps) {
  // Expand/collapse is controlled by the parent (via expandedCommentIds in
  // useComments) so that saving a comment collapses it and scrolling to it
  // from the sidebar can expand it, rather than each thread tracking its
  // own local state.
  const collapsed = !expanded;
  const lineLabel = formatLineLabel(comment.startLine, comment.endLine);

  const screenshotUrls = useMemo(
    () => comment.screenshots.map((s) => URL.createObjectURL(s)),
    [comment.screenshots],
  );

  useEffect(() => {
    return () => {
      screenshotUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [screenshotUrls]);

  return (
    <div
      className={`comment-thread${collapsed ? " comment-thread--collapsed" : ""}`}
      data-comment-id={comment.id}
    >
      <div className="comment-thread__header">
        <span className="comment-thread__badge">{lineLabel}</span>
        {collapsed && (
          <span className="comment-thread__summary-text">
            {summarize(comment.comment, SUMMARY_MAX_LENGTH)}
          </span>
        )}
        <button className="comment-thread__toggle" onClick={onToggleExpanded}>
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="comment-thread__quote">{comment.selectedText}</div>
          <div className="comment-thread__text">{comment.comment}</div>
          {screenshotUrls.length > 0 && (
            <div className="comment-thread__thumbnails">
              {screenshotUrls.map((url, index) => (
                <img
                  key={url}
                  src={url}
                  alt={`Screenshot ${index + 1}`}
                />
              ))}
            </div>
          )}
          <div className="comment-thread__actions">
            <button onClick={() => onEdit(comment.id)}>Edit</button>
            <button onClick={() => onDelete(comment.id)}>Delete</button>
          </div>
        </>
      )}
    </div>
  );
}
