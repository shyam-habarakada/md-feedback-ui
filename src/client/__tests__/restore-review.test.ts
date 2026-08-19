import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { restoreReviewComments } from "../restore-review";
import type { ReviewFile } from "../types";

function makeFile(overrides: Partial<ReviewFile> = {}): ReviewFile {
  const content = overrides.content ?? "# Title\n\nSome paragraph text.\n";
  return {
    path: "/abs/spec.md",
    relativePath: "spec.md",
    content,
    lines: content.split("\n"),
    ...overrides,
  };
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("restoreReviewComments", () => {
  it("returns an empty map when there is no saved review", async () => {
    server.use(
      http.get("/api/review", () => HttpResponse.json({ review: null })),
    );

    const result = await restoreReviewComments([makeFile()]);

    expect(result.size).toBe(0);
  });

  it("returns an empty map when the request fails", async () => {
    server.use(
      http.get("/api/review", () => HttpResponse.json({}, { status: 500 })),
    );

    const result = await restoreReviewComments([makeFile()]);

    expect(result.size).toBe(0);
  });

  it("restores a comment whose block still exists at the same line range", async () => {
    server.use(
      http.get("/api/review", () =>
        HttpResponse.json({
          review: {
            comments: [
              {
                file: "spec.md",
                startLine: 1,
                endLine: 1,
                blockType: "heading",
                selectedText: "Title",
                comment: "Looks good",
                screenshots: [],
              },
            ],
          },
        }),
      ),
    );

    const file = makeFile();
    const result = await restoreReviewComments([file]);

    const comments = result.get(file.path);
    expect(comments).toHaveLength(1);
    expect(comments![0]).toMatchObject({
      filePath: file.path,
      startLine: 1,
      endLine: 1,
      blockType: "heading",
      selectedText: "Title",
      comment: "Looks good",
      screenshots: [],
    });
    expect(comments![0].id).toBeTruthy();
  });

  it("drops a comment whose block no longer exists at that line range", async () => {
    server.use(
      http.get("/api/review", () =>
        HttpResponse.json({
          review: {
            comments: [
              {
                file: "spec.md",
                startLine: 42,
                endLine: 42,
                blockType: "paragraph",
                selectedText: "Deleted section",
                comment: "This paragraph is gone now",
                screenshots: [],
              },
            ],
          },
        }),
      ),
    );

    const result = await restoreReviewComments([makeFile()]);

    expect(result.size).toBe(0);
  });

  it("drops a comment for a file that is no longer part of the review set", async () => {
    server.use(
      http.get("/api/review", () =>
        HttpResponse.json({
          review: {
            comments: [
              {
                file: "removed-file.md",
                startLine: 1,
                endLine: 1,
                blockType: "heading",
                selectedText: "Title",
                comment: "Orphaned",
                screenshots: [],
              },
            ],
          },
        }),
      ),
    );

    const result = await restoreReviewComments([makeFile()]);

    expect(result.size).toBe(0);
  });

  it("fetches and attaches screenshots as File objects", async () => {
    server.use(
      http.get("/api/review", () =>
        HttpResponse.json({
          review: {
            comments: [
              {
                file: "spec.md",
                startLine: 1,
                endLine: 1,
                blockType: "heading",
                selectedText: "Title",
                comment: "See screenshot",
                screenshots: ["/outdir/.review-images/abc123"],
              },
            ],
          },
        }),
      ),
      http.get("/api/review-images/abc123", () =>
        HttpResponse.arrayBuffer(new Uint8Array([1, 2, 3]).buffer, {
          headers: { "Content-Type": "image/png" },
        }),
      ),
    );

    const file = makeFile();
    const result = await restoreReviewComments([file]);

    const comments = result.get(file.path);
    expect(comments).toHaveLength(1);
    expect(comments![0].screenshots).toHaveLength(1);
    expect(comments![0].screenshots[0].name).toBe("abc123");
  });

  it("skips a screenshot that fails to fetch but still restores the comment", async () => {
    server.use(
      http.get("/api/review", () =>
        HttpResponse.json({
          review: {
            comments: [
              {
                file: "spec.md",
                startLine: 1,
                endLine: 1,
                blockType: "heading",
                selectedText: "Title",
                comment: "See screenshot",
                screenshots: ["/outdir/.review-images/missing"],
              },
            ],
          },
        }),
      ),
      http.get("/api/review-images/missing", () => HttpResponse.text("", { status: 404 })),
    );

    const file = makeFile();
    const result = await restoreReviewComments([file]);

    const comments = result.get(file.path);
    expect(comments).toHaveLength(1);
    expect(comments![0].screenshots).toEqual([]);
  });

  it("groups restored comments by file across multiple files", async () => {
    server.use(
      http.get("/api/review", () =>
        HttpResponse.json({
          review: {
            comments: [
              {
                file: "spec.md",
                startLine: 1,
                endLine: 1,
                blockType: "heading",
                selectedText: "Title",
                comment: "A",
                screenshots: [],
              },
              {
                file: "guide.md",
                startLine: 1,
                endLine: 1,
                blockType: "heading",
                selectedText: "Guide",
                comment: "B",
                screenshots: [],
              },
            ],
          },
        }),
      ),
    );

    const specFile = makeFile({
      path: "/abs/spec.md",
      relativePath: "spec.md",
      content: "# Title\n",
      lines: ["# Title", ""],
    });
    const guideFile = makeFile({
      path: "/abs/guide.md",
      relativePath: "guide.md",
      content: "# Guide\n",
      lines: ["# Guide", ""],
    });

    const result = await restoreReviewComments([specFile, guideFile]);

    expect(result.get(specFile.path)).toHaveLength(1);
    expect(result.get(guideFile.path)).toHaveLength(1);
    expect(result.get(specFile.path)![0].comment).toBe("A");
    expect(result.get(guideFile.path)![0].comment).toBe("B");
  });
});
