# md-feedback-ui

Browser-based markdown review UI with inline commenting and screenshot support. Designed for reviewing plans, specs, and documentation — especially with [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

![md-feedback-ui screenshot](feedback.png)

## Features

- GitHub-flavored Markdown rendering with Mermaid diagram support
- Inline block-level commenting on any markdown element
- Comment threads collapse to a one-line summary after saving, and expand again from the thread itself or by clicking the comment in the sidebar
- Screenshot attachments via paste or drag-and-drop
- Multi-file tabs with speckit ordering (spec, plan, tasks, then alphabetical)
- Structured JSON output (`.review.json`) for automation
- Optionally reload comments left in a previous session with `--restore`
- Zero-config: `npx` and go

## Quick Start

```bash
npx md-feedback-ui ./docs/plan.md
```

This opens a browser-based review UI. Add comments inline, attach screenshots, and click Submit. The tool writes a `.review.json` file and exits — see [Where Review Files Are Written](#where-review-files-are-written) for exactly where.

## Claude Code Integration

Install the skill so Claude Code can launch reviews:

```bash
# Add to current project
npx md-feedback-ui --install-skill

# Or add globally (all projects)
npx md-feedback-ui --install-skill --global
```

Then in Claude Code, use the skill:

```
/md-feedback-ui path/to/plan.md
```

**Workflow:**
1. Claude launches the review server
2. You review and comment in the browser, then submit
3. The server writes `.review.json` and exits
4. Claude reads the structured feedback and addresses each comment

## CLI Reference

```
md-feedback-ui <file-or-directory...> [options]
md-feedback-ui --install-skill [--global]
```

| Option | Description |
|--------|-------------|
| `--restore` | Reload comments left in a previous session's `.review.json` |
| `--no-open` | Don't auto-open the browser |
| `--install-skill` | Install the Claude Code skill to `.claude/commands/` |
| `--global` | With `--install-skill`, install to `~/.claude/commands/` |
| `--version` | Show version number |
| `--help` | Show help |

### Examples

```bash
md-feedback-ui plan.md                    # Single file
md-feedback-ui docs/                      # All .md files in directory
md-feedback-ui spec.md plan.md tasks.md   # Multiple files
md-feedback-ui docs/ --restore            # Resume, reloading prior comments
```

### Resuming a review

By default each run starts from a blank slate. Pass `--restore` to reload
comments from a `.review.json` left by a previous session in the same
directory (for example, if the server was closed before you clicked
Submit). Restored comments are matched back to their markdown block by file
and line range — if that block was edited or removed since the comment was
left, the comment is silently dropped rather than shown as orphaned.

## Where Review Files Are Written

`.review.json` and `.review-images/` (if any screenshots were attached) are
written based on how you invoked the CLI, not your current working
directory:

- **Directory argument** — written inside that directory.
  `md-feedback-ui docs/` → `docs/.review.json`
- **File argument(s)** — written into the directory containing the first
  file path given.
  `md-feedback-ui docs/plan.md` → `docs/.review.json`
  `md-feedback-ui docs/spec.md docs/plan.md docs/tasks.md` → `docs/.review.json`

This is also where `--restore` looks for a previous session's
`.review.json`. You can point at the directory on one run and at individual
files inside it on the next (or vice versa) — comments are matched back up
by file and line range relative to that directory, not by which argument
style the CLI happened to be invoked with.

## Output Format

The `.review.json` file contains structured feedback:

```json
{
  "reviewedFiles": ["spec.md", "plan.md"],
  "submittedAt": "2026-03-29T12:00:00.000Z",
  "comments": [
    {
      "file": "plan.md",
      "startLine": 10,
      "endLine": 14,
      "blockType": "paragraph",
      "selectedText": "The text of the block being commented on",
      "comment": "This needs more detail about error handling",
      "screenshots": ["path/to/screenshot.png"]
    }
  ]
}
```

## .gitignore

As covered above, `.review.json` and `.review-images/` can end up anywhere
in your repo depending on how the CLI was invoked. Add these two lines to
your repo's root `.gitignore` so they never get committed no matter where a
review was run from:

```gitignore
.review.json
.review-images/
```

Leaving off the leading `/` is what makes these match at any depth in the
tree, not just the repo root.

## Development

```bash
git clone https://github.com/elithompson/md-feedback-ui.git
cd md-feedback-ui
npm install

# Start dev servers (Vite frontend + Express API)
npm run dev                    # In one terminal
npx tsx src/server/index.ts test-fixtures/ --no-open  # In another

# Run checks
npm run check                  # typecheck + lint + test
```

## Requirements

Node.js >= 18.0.0

## License

MIT
