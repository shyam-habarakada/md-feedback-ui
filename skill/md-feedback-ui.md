---
description: Open markdown files in a browser-based review UI for inline commenting with screenshot support. Use for reviewing plans, specs, or any .md files. Accepts a file path, multiple file paths, or a directory.
---

Launch the md-feedback-ui server for the user to review markdown files in the browser. The review UI renders markdown with Mermaid diagrams, supports inline block-level commenting with screenshot attachments, and multi-file tabs.

Pass either file paths or a directory as arguments: $ARGUMENTS

1. Run the review server. This command blocks until the user submits their review in the browser:

```bash
npx md-feedback-ui $ARGUMENTS
```

   If a `.review.json` from an earlier, interrupted session already exists next to these files (e.g. the server was closed before the user clicked Submit), add `--restore` to reload those comments into the browser instead of starting from a blank slate:

   ```bash
   npx md-feedback-ui $ARGUMENTS --restore
   ```

2. After the command exits, read the `.review.json` file that was written next to the input files. It contains structured feedback with file paths, source line references, selected text, comments, and optional screenshot image paths.

3. Process each comment in order, grouped by file. For each comment:
   - Note which file and line range it refers to
   - Read the `selectedText` to understand what the user is commenting on
   - Read the `comment` for the user's feedback
   - If `screenshots` array is non-empty, read those image files for visual context
   - Address the feedback by making the requested changes or asking clarifying questions

4. After reading all comments and screenshots, clean up the review artifacts:

```bash
rm -rf .review-images/ .review.json
```
