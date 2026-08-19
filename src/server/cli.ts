import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function parseArgs(argv: string[]): {
  flags: Set<string>;
  fileArgs: string[];
} {
  const flags = new Set<string>();
  const fileArgs: string[] = [];
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      flags.add(arg);
    } else {
      fileArgs.push(arg);
    }
  }
  return { flags, fileArgs };
}

export function getPackageVersion(): string {
  const require = createRequire(import.meta.url);
  const pkg = require("../../package.json") as { version: string };
  return pkg.version;
}

export function getSkillSourcePath(): string {
  return path.resolve(__dirname, "../../skill/md-feedback-ui.md");
}

export function installSkill(cwd: string, global: boolean): void {
  const targetDir = global
    ? path.join(
        process.env.HOME ?? process.env.USERPROFILE ?? "~",
        ".claude",
        "commands",
      )
    : path.join(cwd, ".claude", "commands");
  const targetPath = path.join(targetDir, "md-feedback-ui.md");

  if (fs.existsSync(targetPath)) {
    console.log(`Skill already exists at ${targetPath}`);
    return;
  }

  const sourcePath = getSkillSourcePath();
  if (!fs.existsSync(sourcePath)) {
    throw new Error("Skill source file not found. Package may be corrupted.");
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  console.log(`Installed skill to ${targetPath}`);
}

export function printHelp(): void {
  console.log(`md-feedback-ui v${getPackageVersion()}

Browser-based markdown review UI with inline commenting and screenshot support.

Usage:
  md-feedback-ui <file-or-directory...> [options]
  md-feedback-ui --install-skill [--global]

Options:
  --restore          Reload comments left in a previous session's .review.json
  --no-open          Don't auto-open the browser
  --install-skill    Install the Claude Code skill to .claude/commands/
  --global           With --install-skill, install to ~/.claude/commands/
  --version          Show version number
  --help             Show this help message

Examples:
  md-feedback-ui plan.md
  md-feedback-ui docs/
  md-feedback-ui spec.md plan.md tasks.md
  md-feedback-ui docs/ --restore
  md-feedback-ui --install-skill
  md-feedback-ui --install-skill --global`);
}
