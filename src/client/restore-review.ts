import type { Comment, ReviewFile } from "./types";
import { getBlockRanges, blockExists, type BlockRange } from "./block-ranges";

interface SavedComment {
  file: string;
  startLine: number;
  endLine: number;
  blockType: string;
  selectedText: string;
  comment: string;
  screenshots: string[];
}

interface SavedReview {
  comments?: SavedComment[];
}

function screenshotFilename(savedPath: string): string {
  return savedPath.split(/[\\/]/).pop() ?? savedPath;
}

async function fetchScreenshot(savedPath: string): Promise<File | null> {
  const filename = screenshotFilename(savedPath);
  try {
    const response = await fetch(
      `/api/review-images/${encodeURIComponent(filename)}`,
    );
    if (!response.ok) return null;
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  } catch {
    return null;
  }
}

/**
 * Fetches the previously saved review (if any) and rebuilds Comment objects
 * for it, keyed by the current files' absolute paths. Saved comments whose
 * block no longer exists at the same line range in the current file content
 * are dropped rather than shown as orphaned/misplaced.
 */
export async function restoreReviewComments(
  files: ReviewFile[],
): Promise<Map<string, Comment[]>> {
  const result = new Map<string, Comment[]>();

  let review: SavedReview | null;
  try {
    const response = await fetch("/api/review");
    if (!response.ok) return result;
    const json: { review: SavedReview | null } = await response.json();
    review = json.review;
  } catch {
    return result;
  }

  if (!review?.comments?.length) return result;

  const filesByRelativePath = new Map(files.map((f) => [f.relativePath, f]));
  const rangesByFilePath = new Map<string, BlockRange[]>();

  for (const saved of review.comments) {
    const file = filesByRelativePath.get(saved.file);
    if (!file) continue;

    let ranges = rangesByFilePath.get(file.path);
    if (!ranges) {
      ranges = getBlockRanges(file.content);
      rangesByFilePath.set(file.path, ranges);
    }

    if (!blockExists(ranges, saved.startLine, saved.endLine)) continue;

    const screenshots = (
      await Promise.all(saved.screenshots.map(fetchScreenshot))
    ).filter((f): f is File => f !== null);

    const comment: Comment = {
      id: crypto.randomUUID(),
      filePath: file.path,
      startLine: saved.startLine,
      endLine: saved.endLine,
      blockType: saved.blockType,
      selectedText: saved.selectedText,
      comment: saved.comment,
      screenshots,
    };

    const existing = result.get(file.path) ?? [];
    result.set(file.path, [...existing, comment]);
  }

  return result;
}
