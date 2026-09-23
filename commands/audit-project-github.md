---
codex-description: "Create GitHub issues for non-security deferred findings identified by /audit-project."
---

# /audit-project: GitHub issues

Reference for the "Create issues" choice in `/audit-project` (`audit-project.md`). Runs only when the user picked it: filing issues publishes findings, so it is never a default.

## Preconditions

`git` and `gh` are installed, `gh auth status` succeeds, and `origin` points at GitHub. If any is missing, keep the findings in `TECHNICAL_DEBT.md` and say why issues were not created.

## What gets filed

Deferred findings that are not security-sensitive. Show the user the list of titles before creating them, since each one lands in a public or shared tracker.

Never file security findings (credential or token exposure, authentication or authorization flaws, injection, anything exploitable). A public issue discloses the hole before it is fixed. Fix them now if you can; otherwise list them in the report by file and severity only.

```bash
gh issue create --title "<title>" --body-file <body.md>
```

Issue body:

```markdown
## Issue from /audit-project

**Severity**: Critical | High | Medium | Low
**Category**: Performance | Architecture | Code Quality | Enhancement
**Effort**: Small | Medium | Large

### Description
{what is wrong and why it matters}

### Current Behavior
{1 to 3 lines of the code, fenced with its language}

### Proposed Fix
{the specific change}

### Files
- {path:line}
```

## TECHNICAL_DEBT.md afterwards

Remove `TECHNICAL_DEBT.md` only when every non-security item in it now has an issue, no security items are in it, and the user did not pass `--create-tech-debt`. Otherwise keep it and update it.

## Commit

Commit only the files the audit changed (the fixes and `TECHNICAL_DEBT.md`), named explicitly with `git add <files>`. Other uncommitted work in the tree is the user's and stays out of the commit.

```
chore: audit-project complete - issues tracked in GitHub

Created N GitHub issues for deferred items:
- #123: {title}

Security-sensitive findings (M) kept internal.
Fixed K issues in this review session.
```
