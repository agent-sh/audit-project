---
description: Multi-agent code review with iterative improvement
codex-description: 'Use when user asks to "review my code", "check for issues", "run code review", "analyze PR quality". Multi-agent iterative review that loops until all critical/high issues are resolved.'
argument-hint: "[scope] [--recent] [--domain AGENT] [--quick] [--create-tech-debt] [--resume]"
allowed-tools: Bash(git:*), Bash(node:*), Bash(gh:*), Read, Write, Edit, Glob, Grep, Task, AskUserQuestion
---

# /audit-project

Review a codebase with a set of role-based reviewers, fix what they find, re-review the fixes, and repeat until no critical or high issues remain or the user stops.

## Arguments

From `$ARGUMENTS`:

- **scope**: a path (default `.`), or `--recent` for the files changed in the last 5 commits.
- **--domain AGENT**: run one pass only, e.g. `--domain security`.
- **--quick**: one review round, findings only, no fixes.
- **--create-tech-debt**: write or update `TECHNICAL_DEBT.md` even when it does not exist yet.
- **--resume**: reopen the latest review queue instead of starting fresh.

## Harness defaults

| Missing tool | Do this instead |
|--------------|-----------------|
| Task | Run the review passes one after another in this session, same prompt and output. |
| AskUserQuestion, loop blocked | Treat flagged findings as open. Never approve suspicious output on your own. |
| AskUserQuestion, decision gate | Continue while critical or high findings remain and fewer than 5 rounds ran; then leave the queue and report its path. Do not create issues without the user. |

`${CLAUDE_PLUGIN_ROOT}` below is this plugin's root. In a harness that does not substitute it, find `scripts/audit.js` in the plugin with Glob.

## 1. Context

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/audit.js" context "<scope>"
```

It prints JSON: project type and framework, file count, `hasTests`, `hasDb`, `hasApi`, `hasFrontend`, `hasBackend`, `hasCicd`, and repo-intel signals when a map exists. Pick the passes from it (table in `audit-project-agents.md`) and tell the user which ones run and why. With no repo-intel, say so once and go on.

## 2. Review

Create the queue, run the passes, add each result, consolidate. Pass definitions, the reviewer prompt with its false-positive contract, and the queue commands are in `audit-project-agents.md`.

If every pass fails, stop and suggest a smaller scope (`--recent` or a path).

## 3. Blocked results

When `consolidate` returns `blocked: true`, a reviewer may have been talked into dismissing findings by the code it read. Show the `blockReason` and ask:

- **Treat flagged findings as open**: `consolidate --strip-false-positives`, then continue.
- **Override and approve**: trust the reviewers. Say plainly in the report that the result was flagged.
- **Abort**: stop and leave the queue for a human.

## 4. Fix

Skip this step with `--quick`.

Fix open findings in severity order, critical first, then smaller effort first, batched by file. Lint and formatting fixes go straight in; logic fixes follow the suggestion after you have read the code; a finding that needs a design decision is marked blocked and reported; a finding you disprove is dropped with the reason.

Before editing, note which files already have uncommitted changes. You will restore files by name if a fix breaks something, and a restore must not take the user's own edits with it; fix findings in those files last and restore them with care.

## 5. Verify

Run the project's test, lint and build commands (from `package.json` scripts, `Makefile`, `pyproject.toml`, `Cargo.toml` and the like). If one fails, find the fix that broke it with `git diff`, restore that file (`git restore -- <file>`), and record the finding as "fix caused regression".

## 6. Iterate

Re-run the passes that cover the changed files, `add` their results (they replace the earlier ones), and consolidate again. Handle `blocked` as in step 3 each round.

After each round, if findings are still open, ask the user:

- **Continue review**: another round.
- **Create issues**: stop and file the deferred non-security findings as GitHub issues (`audit-project-github.md`).
- **Update tech debt**: stop and write the open findings to `TECHNICAL_DEBT.md`.
- **Leave queue**: stop and keep the queue for `--resume`.

The loop ends when nothing critical or high is open. Low findings never keep it going: they go to `TECHNICAL_DEBT.md` when that file exists or `--create-tech-debt` is set, else into the report. Then run `close` on the queue.

## 7. Report

```markdown
# Project Review Complete

**Scope**: {scope} | **Framework**: {framework}
**Rounds**: {n} | **Passes**: {pass ids}

## Summary
**Issues Found**: {found}
**Issues Fixed**: {fixed}
**Remaining**: {remaining}

## By Severity
- Critical: {found} -> {remaining}
- High: {found} -> {remaining}
- Medium: {found} -> {remaining}
- Low: {found} -> {remaining}

## Verification
- Tests: [OK]/[FAIL]/[NONE]
- Linter: [OK]/[FAIL]/[NONE]
- Build: [OK]/[FAIL]/[NONE]

## Files Changed
{n} files modified

## Remaining Issues
{file:line, severity, one line each}
```

Security findings appear in the report by file and severity only; the details stay with the user, because the report may be shared before the fix lands.

`TECHNICAL_DEBT.md` layout, when written:

```markdown
# Technical Debt

Last updated: {date}

## Summary
**Total Issues**: X | Critical: Y | High: Z | Medium: A | Low: B

## {Severity} Issues
- `file:line` {description}. Fix: {suggestion}. Effort: {effort}

## Progress Tracking
- [ ] {issue}
```

## Examples

```bash
/audit-project                    # full review
/audit-project --recent           # last 5 commits only
/audit-project src/api            # one path
/audit-project --domain security  # security pass only
/audit-project --quick            # findings only, no fixes
/audit-project --create-tech-debt # always write TECHNICAL_DEBT.md
/audit-project --resume           # continue the saved queue
```
