// @vitest-environment node
import { describe, it, expect } from "vitest";
import { getBlockRanges, blockExists } from "../block-ranges";

describe("getBlockRanges", () => {
  it("returns a range for a heading", () => {
    const ranges = getBlockRanges("# Hello");
    expect(ranges).toEqual([{ startLine: 1, endLine: 1 }]);
  });

  it("returns ranges for multiple blocks in document order", () => {
    const ranges = getBlockRanges("# Title\n\nSome paragraph text.\n");
    expect(ranges).toEqual([
      { startLine: 1, endLine: 1 },
      { startLine: 3, endLine: 3 },
    ]);
  });

  it("includes list items and code blocks", () => {
    const ranges = getBlockRanges("- item one\n- item two\n\n```\ncode\n```\n");
    const startLines = ranges.map((r) => r.startLine);
    expect(startLines).toContain(1); // list
    expect(startLines).toContain(1); // listItem one shares start
    expect(startLines).toContain(2); // listItem two
    expect(startLines).toContain(4); // code block
  });

  it("does not include inline nodes like emphasis", () => {
    const ranges = getBlockRanges("*emphasized*");
    // Only the wrapping paragraph should be present, not the emphasis span.
    expect(ranges).toEqual([{ startLine: 1, endLine: 1 }]);
  });
});

describe("blockExists", () => {
  it("returns true when a range with the exact start/end line is present", () => {
    const ranges = [{ startLine: 3, endLine: 5 }];
    expect(blockExists(ranges, 3, 5)).toBe(true);
  });

  it("returns false when no range matches", () => {
    const ranges = [{ startLine: 3, endLine: 5 }];
    expect(blockExists(ranges, 3, 4)).toBe(false);
    expect(blockExists(ranges, 1, 1)).toBe(false);
  });

  it("returns false for an empty ranges list", () => {
    expect(blockExists([], 1, 1)).toBe(false);
  });
});
