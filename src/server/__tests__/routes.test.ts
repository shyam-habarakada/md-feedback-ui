// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "node:http";
import request from "supertest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { registerRoutes } from "../routes.js";
import type { ResolvedFile } from "../resolve-files.js";

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "routes-test-"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function createApp(
  files: ResolvedFile[],
  outputDir?: string,
  enableRestore = true,
) {
  const app = express();
  app.use(express.json());
  const server = http.createServer(app);
  const dir = outputDir ?? tmpDir;

  // Mock process.exit and server.close so the test doesn't actually shut down
  const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
    return undefined as never;
  });
  const mockClose = vi.spyOn(server, "close").mockImplementation((cb) => {
    if (cb) cb();
    return server;
  });

  registerRoutes(app, files, dir, server, enableRestore);

  return { app, server, mockExit, mockClose, cleanup: () => {
    mockExit.mockRestore();
    mockClose.mockRestore();
  }};
}

describe("GET /api/files", () => {
  it("returns the files array with path, relativePath, and content", async () => {
    const files: ResolvedFile[] = [
      { path: "/tmp/spec.md", relativePath: "spec.md", content: "# Spec" },
      { path: "/tmp/plan.md", relativePath: "plan.md", content: "# Plan" },
    ];
    const { app, cleanup } = createApp(files);

    const res = await request(app).get("/api/files").expect(200);

    expect(res.body.files).toHaveLength(2);
    expect(res.body.files[0]).toEqual({
      path: "/tmp/spec.md",
      relativePath: "spec.md",
      content: "# Spec",
    });
    expect(res.body.files[1]).toEqual({
      path: "/tmp/plan.md",
      relativePath: "plan.md",
      content: "# Plan",
    });

    cleanup();
  });
});

describe("POST /api/submit", () => {
  it("writes .review.json and responds with success", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "submit-test-"));
    const files: ResolvedFile[] = [];
    const { app, cleanup } = createApp(files, outDir);

    const reviewPayload = {
      status: "approved",
      comments: [{ line: 1, text: "Looks good" }],
    };

    const res = await request(app)
      .post("/api/submit")
      .field("review", JSON.stringify(reviewPayload))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.outputPath).toBe(path.join(outDir, ".review.json"));

    // Verify the file was actually written
    const written = JSON.parse(
      fs.readFileSync(path.join(outDir, ".review.json"), "utf-8"),
    );
    expect(written).toEqual(reviewPayload);

    cleanup();
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("written .review.json content matches submitted payload exactly", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "submit-test2-"));
    const files: ResolvedFile[] = [];
    const { app, cleanup } = createApp(files, outDir);

    const reviewPayload = {
      verdict: "changes-requested",
      sections: [
        { file: "spec.md", comments: ["Add error handling section"] },
      ],
    };

    await request(app)
      .post("/api/submit")
      .field("review", JSON.stringify(reviewPayload))
      .expect(200);

    const written = JSON.parse(
      fs.readFileSync(path.join(outDir, ".review.json"), "utf-8"),
    );
    expect(written).toEqual(reviewPayload);

    cleanup();
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("populates comment screenshots with server-side file paths", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "submit-screenshots-"));
    const files: ResolvedFile[] = [];
    const { app, cleanup } = createApp(files, outDir);

    const reviewPayload = {
      reviewedFiles: ["/tmp/spec.md"],
      submittedAt: "2026-03-29T12:00:00.000Z",
      comments: [
        {
          file: "spec.md",
          startLine: 1,
          endLine: 1,
          blockType: "heading",
          selectedText: "Title",
          comment: "Needs work",
          screenshots: [],
        },
        {
          file: "spec.md",
          startLine: 5,
          endLine: 8,
          blockType: "paragraph",
          selectedText: "Some text",
          comment: "Add detail",
          screenshots: [],
        },
      ],
    };

    const imgA = Buffer.from("fake-png-a");
    const imgB = Buffer.from("fake-png-b");

    const res = await request(app)
      .post("/api/submit")
      .field("review", JSON.stringify(reviewPayload))
      .attach("screenshot_0", imgA, "shot-a.png")
      .attach("screenshot_1", imgB, "shot-b.png")
      .expect(200);

    expect(res.body.success).toBe(true);

    const written = JSON.parse(
      fs.readFileSync(path.join(outDir, ".review.json"), "utf-8"),
    );

    // Comment 0 should have one screenshot path
    expect(written.comments[0].screenshots).toHaveLength(1);
    expect(written.comments[0].screenshots[0]).toMatch(/\.review-images\//);
    expect(fs.existsSync(written.comments[0].screenshots[0])).toBe(true);

    // Comment 1 should have one screenshot path
    expect(written.comments[1].screenshots).toHaveLength(1);
    expect(written.comments[1].screenshots[0]).toMatch(/\.review-images\//);
    expect(fs.existsSync(written.comments[1].screenshots[0])).toBe(true);

    cleanup();
    fs.rmSync(outDir, { recursive: true, force: true });
  });
});

describe("GET /api/review", () => {
  it("returns review: null when no .review.json exists", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-get-"));
    const { app, cleanup } = createApp([], outDir);

    const res = await request(app).get("/api/review").expect(200);

    expect(res.body).toEqual({ review: null });

    cleanup();
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("returns the parsed contents of an existing .review.json", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-get2-"));
    const reviewPayload = {
      reviewedFiles: ["/tmp/spec.md"],
      submittedAt: "2026-03-29T12:00:00.000Z",
      comments: [
        {
          file: "spec.md",
          startLine: 1,
          endLine: 1,
          blockType: "heading",
          selectedText: "Title",
          comment: "Needs work",
          screenshots: [],
        },
      ],
    };
    fs.writeFileSync(
      path.join(outDir, ".review.json"),
      JSON.stringify(reviewPayload),
    );
    const { app, cleanup } = createApp([], outDir);

    const res = await request(app).get("/api/review").expect(200);

    expect(res.body.review).toEqual(reviewPayload);

    cleanup();
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("returns review: null when .review.json contains invalid JSON", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-get3-"));
    fs.writeFileSync(path.join(outDir, ".review.json"), "{not valid json");
    const { app, cleanup } = createApp([], outDir);

    const res = await request(app).get("/api/review").expect(200);

    expect(res.body).toEqual({ review: null });

    cleanup();
    fs.rmSync(outDir, { recursive: true, force: true });
  });
});

describe("GET /api/review-images/:filename", () => {
  it("serves a saved screenshot with a sniffed image content type", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-img-"));
    const imageDir = path.join(outDir, ".review-images");
    fs.mkdirSync(imageDir, { recursive: true });
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    fs.writeFileSync(path.join(imageDir, "abc123"), pngBytes);
    const { app, cleanup } = createApp([], outDir);

    const res = await request(app)
      .get("/api/review-images/abc123")
      .expect(200);

    expect(res.headers["content-type"]).toBe("image/png");
    expect(Buffer.compare(res.body, pngBytes)).toBe(0);

    cleanup();
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("returns 404 for a missing screenshot", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-img2-"));
    const { app, cleanup } = createApp([], outDir);

    await request(app).get("/api/review-images/does-not-exist").expect(404);

    cleanup();
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("does not allow path traversal outside the image directory", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-img3-"));
    fs.mkdirSync(path.join(outDir, ".review-images"), { recursive: true });
    const secretPath = path.join(outDir, "secret.txt");
    fs.writeFileSync(secretPath, "top secret");
    const { app, cleanup } = createApp([], outDir);

    const res = await request(app).get(
      "/api/review-images/..%2Fsecret.txt",
    );

    expect(res.status).toBe(404);

    cleanup();
    fs.rmSync(outDir, { recursive: true, force: true });
  });
});

describe("restore routes gated behind enableRestore", () => {
  it("404s on /api/review and /api/review-images/:filename when restore is disabled", async () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "review-disabled-"));
    const reviewPayload = { comments: [] };
    fs.writeFileSync(
      path.join(outDir, ".review.json"),
      JSON.stringify(reviewPayload),
    );
    const imageDir = path.join(outDir, ".review-images");
    fs.mkdirSync(imageDir, { recursive: true });
    fs.writeFileSync(path.join(imageDir, "abc123"), Buffer.from("fake-png"));

    const { app, cleanup } = createApp([], outDir, false);

    await request(app).get("/api/review").expect(404);
    await request(app).get("/api/review-images/abc123").expect(404);

    cleanup();
    fs.rmSync(outDir, { recursive: true, force: true });
  });
});
