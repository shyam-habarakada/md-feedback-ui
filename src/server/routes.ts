import * as fs from "node:fs";
import * as path from "node:path";
import type { Express } from "express";
import type { Server } from "node:http";
import multer from "multer";
import type { ResolvedFile } from "./resolve-files.js";

interface ReviewComment {
  file: string;
  startLine: number;
  endLine: number;
  blockType: string;
  selectedText: string;
  comment: string;
  screenshots: string[];
}

interface ReviewPayload {
  reviewedFiles: string[];
  submittedAt: string;
  comments: ReviewComment[];
}

const IMAGE_SIGNATURES: Array<{ type: string; magic: number[] }> = [
  { type: "image/png", magic: [0x89, 0x50, 0x4e, 0x47] },
  { type: "image/jpeg", magic: [0xff, 0xd8, 0xff] },
  { type: "image/gif", magic: [0x47, 0x49, 0x46, 0x38] },
  { type: "image/webp", magic: [0x52, 0x49, 0x46, 0x46] },
];

function sniffImageType(buffer: Buffer): string {
  for (const { type, magic } of IMAGE_SIGNATURES) {
    if (magic.every((byte, i) => buffer[i] === byte)) return type;
  }
  return "application/octet-stream";
}

export function registerRoutes(
  app: Express,
  files: ResolvedFile[],
  outputDir: string,
  server: Server,
  enableRestore: boolean,
): void {
  const imageDir = path.join(outputDir, ".review-images");
  const upload = multer({ dest: imageDir });
  const reviewPath = path.join(outputDir, ".review.json");

  app.get("/api/files", (_req, res) => {
    res.json({ files });
  });

  if (enableRestore) {
    app.get("/api/review", (_req, res) => {
      if (!fs.existsSync(reviewPath)) {
        res.json({ review: null });
        return;
      }

      try {
        const review = JSON.parse(fs.readFileSync(reviewPath, "utf-8"));
        res.json({ review });
      } catch {
        res.json({ review: null });
      }
    });

    app.get("/api/review-images/:filename", (req, res) => {
      const filename = path.basename(req.params.filename);
      const filePath = path.join(imageDir, filename);

      if (!fs.existsSync(filePath)) {
        res.status(404).end();
        return;
      }

      const buffer = fs.readFileSync(filePath);
      res.setHeader("Content-Type", sniffImageType(buffer));
      res.send(buffer);
    });
  }

  app.post("/api/submit", upload.any(), (req, res) => {
    const reviewJson = (req as unknown as { body: Record<string, string> }).body
      .review;
    if (!reviewJson) {
      res.status(400).json({ error: "Missing review field" });
      return;
    }

    let review: ReviewPayload;
    try {
      review = JSON.parse(reviewJson) as ReviewPayload;
    } catch {
      res.status(400).json({ error: "Invalid JSON in review field" });
      return;
    }

    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    // Map uploaded files back to their comments.
    // Field names follow the pattern "screenshot_<commentIndex>".
    const uploadedFiles =
      (req as unknown as { files?: Array<{ fieldname: string; path: string }> })
        .files ?? [];

    for (const file of uploadedFiles) {
      const match = file.fieldname.match(/^screenshot_(\d+)$/);
      if (!match) continue;
      const commentIndex = Number(match[1]);
      if (commentIndex < review.comments.length) {
        review.comments[commentIndex].screenshots.push(file.path);
      }
    }

    const outputPath = path.join(outputDir, ".review.json");
    fs.writeFileSync(outputPath, JSON.stringify(review, null, 2));

    res.json({ success: true, outputPath });

    setTimeout(() => {
      server.close(() => {
        process.exit(0);
      });
    }, 500);
  });
}
