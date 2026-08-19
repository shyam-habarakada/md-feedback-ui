import * as fs from "node:fs";
import * as path from "node:path";
import { globSync } from "glob";

export interface ResolvedFile {
  path: string;
  relativePath: string;
  content: string;
}

const SPECKIT_ORDER: Record<string, number> = {
  "spec.md": 0,
  "plan.md": 1,
  "tasks.md": 2,
};

function speckitSort(a: ResolvedFile, b: ResolvedFile): number {
  const aBase = path.basename(a.relativePath);
  const bBase = path.basename(b.relativePath);
  const aOrder = SPECKIT_ORDER[aBase] ?? Infinity;
  const bOrder = SPECKIT_ORDER[bBase] ?? Infinity;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.relativePath.localeCompare(b.relativePath);
}

function resolveArg(arg: string): ResolvedFile[] {
  const resolved = path.resolve(arg);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist: ${resolved}`);
  }

  const stat = fs.statSync(resolved);

  if (stat.isFile()) {
    return [
      {
        path: resolved,
        relativePath: path.basename(resolved),
        content: fs.readFileSync(resolved, "utf-8"),
      },
    ];
  }

  if (stat.isDirectory()) {
    const mdFiles = globSync("*.md", { cwd: resolved }).sort();
    if (mdFiles.length === 0) {
      throw new Error(`No .md files found in directory: ${resolved}`);
    }

    const dirName = path.basename(resolved);
    return mdFiles.map((name) => {
      const filePath = path.join(resolved, name);
      return {
        path: filePath,
        relativePath: `${dirName}/${name}`,
        content: fs.readFileSync(filePath, "utf-8"),
      };
    });
  }

  throw new Error(`Unsupported path type: ${resolved}`);
}

export function resolveFiles(args: string[]): ResolvedFile[] {
  if (args.length === 0) {
    throw new Error("No files or directories provided");
  }

  const seen = new Set<string>();
  const files: ResolvedFile[] = [];

  for (const arg of args) {
    for (const file of resolveArg(arg)) {
      if (!seen.has(file.path)) {
        seen.add(file.path);
        files.push(file);
      }
    }
  }

  files.sort(speckitSort);
  return files;
}

/**
 * The directory a review session's .review.json/.review-images live in:
 * the first argument itself if it's a directory, otherwise the directory
 * containing the first resolved file.
 */
export function resolveOutputDir(
  fileArgs: string[],
  files: ResolvedFile[],
): string {
  const firstArg = path.resolve(fileArgs[0]);
  return fs.statSync(firstArg).isDirectory()
    ? firstArg
    : path.dirname(files[0].path);
}

/**
 * Rewrites each file's relativePath to be relative to outputDir instead of
 * whatever per-argument convention resolveFiles used. This is what gets
 * saved into .review.json and matched back up on --restore, so it needs to
 * be stable no matter whether the CLI was invoked with a directory or with
 * individual file paths pointing at the same files.
 */
export function relativizeToOutputDir(
  files: ResolvedFile[],
  outputDir: string,
): ResolvedFile[] {
  return files.map((file) => ({
    ...file,
    relativePath: path.relative(outputDir, file.path),
  }));
}
