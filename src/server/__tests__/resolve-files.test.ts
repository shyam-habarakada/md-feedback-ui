// @vitest-environment node
import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  resolveFiles,
  resolveOutputDir,
  relativizeToOutputDir,
} from "../resolve-files.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "resolve-files-test-"));
}

const tmpDirs: string[] = [];

function createTmpDir(): string {
  const dir = makeTmpDir();
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe("resolveFiles", () => {
  it("returns a single ResolvedFile for a .md file path", () => {
    const dir = createTmpDir();
    const filePath = path.join(dir, "readme.md");
    fs.writeFileSync(filePath, "# Hello");

    const result = resolveFiles([filePath]);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe(filePath);
    expect(result[0].relativePath).toBe("readme.md");
    expect(result[0].content).toBe("# Hello");
  });

  it("returns all .md files from a directory sorted in speckit convention", () => {
    const dir = createTmpDir();
    const dirName = path.basename(dir);
    fs.writeFileSync(path.join(dir, "tasks.md"), "tasks");
    fs.writeFileSync(path.join(dir, "alpha.md"), "alpha");
    fs.writeFileSync(path.join(dir, "spec.md"), "spec");
    fs.writeFileSync(path.join(dir, "plan.md"), "plan");
    fs.writeFileSync(path.join(dir, "zebra.md"), "zebra");
    fs.writeFileSync(path.join(dir, "ignore.txt"), "not markdown");

    const result = resolveFiles([dir]);

    expect(result.map((f) => f.relativePath)).toEqual([
      `${dirName}/spec.md`,
      `${dirName}/plan.md`,
      `${dirName}/tasks.md`,
      `${dirName}/alpha.md`,
      `${dirName}/zebra.md`,
    ]);
    expect(result).toHaveLength(5);
    expect(result[0].content).toBe("spec");
  });

  it("returns each file when given multiple file args", () => {
    const dir = createTmpDir();
    const fileA = path.join(dir, "a.md");
    const fileB = path.join(dir, "b.md");
    fs.writeFileSync(fileA, "aaa");
    fs.writeFileSync(fileB, "bbb");

    const result = resolveFiles([fileA, fileB]);

    expect(result).toHaveLength(2);
    expect(result.map((f) => f.relativePath)).toEqual(["a.md", "b.md"]);
  });

  it("throws an error for a directory with no .md files", () => {
    const dir = createTmpDir();
    fs.writeFileSync(path.join(dir, "data.txt"), "text");

    expect(() => resolveFiles([dir])).toThrow(/no .md files/i);
  });

  it("throws an error for a nonexistent path", () => {
    expect(() => resolveFiles(["/no/such/path/foo.md"])).toThrow(
      /does not exist/i,
    );
  });

  it("throws an error when no args are provided", () => {
    expect(() => resolveFiles([])).toThrow(/no files/i);
  });

  it("resolves mixed files and directories, deduplicating results", () => {
    const dir = createTmpDir();
    const specFile = path.join(dir, "spec.md");
    const planFile = path.join(dir, "plan.md");
    fs.writeFileSync(specFile, "spec content");
    fs.writeFileSync(planFile, "plan content");

    // Pass the directory AND one file that's already in it
    const result = resolveFiles([dir, specFile]);

    // Should deduplicate: spec.md appears only once
    const paths = result.map((f) => f.path);
    const unique = [...new Set(paths)];
    expect(paths).toEqual(unique);
    expect(result).toHaveLength(2);
  });

  it("uses the parent directory name as prefix for directory-resolved files", () => {
    const dir = createTmpDir();
    const subDir = path.join(dir, "042-feature");
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, "plan.md"), "plan");

    const result = resolveFiles([subDir]);

    expect(result[0].relativePath).toBe("042-feature/plan.md");
  });
});

describe("resolveOutputDir", () => {
  it("uses the directory itself when the first arg is a directory", () => {
    const dir = createTmpDir();
    fs.writeFileSync(path.join(dir, "plan.md"), "plan");

    const files = resolveFiles([dir]);
    expect(resolveOutputDir([dir], files)).toBe(dir);
  });

  it("uses the containing directory when the first arg is a file", () => {
    const dir = createTmpDir();
    const filePath = path.join(dir, "plan.md");
    fs.writeFileSync(filePath, "plan");

    const files = resolveFiles([filePath]);
    expect(resolveOutputDir([filePath], files)).toBe(dir);
  });

  it("resolves to the same outputDir whether invoked with the directory or the file directly", () => {
    const dir = createTmpDir();
    const filePath = path.join(dir, "plan.md");
    fs.writeFileSync(filePath, "plan");

    const viaDir = resolveOutputDir([dir], resolveFiles([dir]));
    const viaFile = resolveOutputDir([filePath], resolveFiles([filePath]));

    expect(viaDir).toBe(viaFile);
  });
});

describe("relativizeToOutputDir", () => {
  it("rewrites relativePath relative to outputDir", () => {
    const dir = createTmpDir();
    const filePath = path.join(dir, "plan.md");
    fs.writeFileSync(filePath, "plan");

    const files = resolveFiles([dir]);
    const result = relativizeToOutputDir(files, dir);

    expect(result[0].relativePath).toBe("plan.md");
  });

  it("produces the same relativePath regardless of whether the CLI was invoked with the directory or the file directly", () => {
    // Regression test: previously resolveFiles alone produced "plan.md" for
    // a file arg but "docs/plan.md" for a directory arg pointing at the
    // same file, which broke matching saved comments back up on --restore
    // whenever the invocation style differed between the submit run and
    // the restore run.
    const dir = createTmpDir();
    const filePath = path.join(dir, "plan.md");
    fs.writeFileSync(filePath, "plan");

    const outputDirViaDir = resolveOutputDir([dir], resolveFiles([dir]));
    const viaDir = relativizeToOutputDir(
      resolveFiles([dir]),
      outputDirViaDir,
    );

    const outputDirViaFile = resolveOutputDir(
      [filePath],
      resolveFiles([filePath]),
    );
    const viaFile = relativizeToOutputDir(
      resolveFiles([filePath]),
      outputDirViaFile,
    );

    expect(viaDir[0].relativePath).toBe("plan.md");
    expect(viaFile[0].relativePath).toBe("plan.md");
    expect(viaDir[0].relativePath).toBe(viaFile[0].relativePath);
  });

  it("does not mutate the original ResolvedFile objects", () => {
    const dir = createTmpDir();
    const subDir = path.join(dir, "sub");
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, "plan.md"), "plan");

    const files = resolveFiles([subDir]);
    const original = files[0].relativePath;

    relativizeToOutputDir(files, subDir);

    expect(files[0].relativePath).toBe(original);
  });
});
