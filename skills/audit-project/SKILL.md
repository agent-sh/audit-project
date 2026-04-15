---
name: audit-project
description: "Use when user asks to 'review my code', 'audit the codebase', 'run code review', 'check for issues', 'find bugs', 'security review', 'performance review', or wants multi-agent iterative review. Spawns role-based reviewers (code-quality-reviewer, security-expert, performance-engineer, test-quality-guardian, architecture-reviewer, database-specialist, api-designer, frontend-specialist, backend-specialist, devops-reviewer) and loops until critical/high issues are resolved."
argument-hint: "[scope] [--recent] [--domain AGENT] [--quick] [--create-tech-debt] [--resume]"
---

# audit-project

Multi-agent iterative code review. Spawn up to 10 specialized role-based reviewers based on project characteristics, collect findings with severity classification, apply fixes, and iterate until no critical or high issues remain.

## When to use

- User says "audit the code", "review the project", "find issues", "security review", "perf review"
- Pre-release quality check
- Post-refactor verification
- Onboarding review of unfamiliar code
- Reviewing AI-generated changes before merge

## Inputs

- **scope** (positional): Path to review, or `--recent` for last 5 commits. Default: `.`
- **--domain AGENT**: Restrict to one reviewer (e.g. `--domain security`)
- **--quick**: Single pass, skip the iteration loop
- **--create-tech-debt**: Force create or update `TECHNICAL_DEBT.md`
- **--resume**: Continue from an existing review queue in the state dir

## Behavior

The skill delegates to the `/audit-project` command, which orchestrates the full 8-phase workflow:

1. **Context & Agent Selection** - Detect project type, framework, and pick which reviewers apply
2. **Multi-Agent Review** - Spawn role-based reviewers in parallel (code-quality-reviewer, security-expert, performance-engineer, architecture-reviewer, database-specialist, api-designer, frontend-specialist, backend-specialist, devops-reviewer, test-quality-guardian)
3. **Tech Debt Extraction** - Low-severity findings feed `TECHNICAL_DEBT.md` instead of the fix queue
4. **Fixes** - Apply critical and high findings
5. **Verification** - Re-run affected reviewers on fixed code
6. **Iteration** - Loop phases 2-5 until no critical or high remain or max rounds hit
7. **Completion Report** - Summarize findings, fixes, deferred items
8. **GitHub Issues** - Optionally file issues for remaining medium/low findings

## Reviewers (role-based, spawned inline)

| Reviewer | Focus |
|----------|-------|
| code-quality-reviewer | Clarity, naming, complexity, dead code |
| security-expert | Injection, auth, secrets, input validation |
| performance-engineer | N+1, memory, hot paths, algorithmic cost |
| architecture-reviewer | Module boundaries, coupling, layering |
| test-quality-guardian | Coverage gaps, flaky tests, assertion quality |
| database-specialist | Schema design, indexes, transactions |
| api-designer | Contracts, versioning, error semantics |
| frontend-specialist | Accessibility, state management, render cost |
| backend-specialist | Scaling, concurrency, error handling |
| devops-reviewer | CI/CD, secrets exposure, build hygiene |

These are spawned dynamically via the Task tool. There are no file-based agent definitions for them.

## Severity classification

- **CRITICAL** - Security vuln, data loss, outage risk. Must fix before merge.
- **HIGH** - Bug or regression likely. Fix before merge.
- **MEDIUM** - Quality or maintainability concern. Address in PR or file issue.
- **LOW** - Style, nit, future improvement. Goes to `TECHNICAL_DEBT.md` or closed as won't-fix.

## Typical invocations

```bash
/audit-project                   # Full review of current directory
/audit-project src/auth          # Scope to a path
/audit-project --recent          # Only last 5 commits
/audit-project --domain security # Security reviewer only
/audit-project --quick           # Single pass, no iteration
/audit-project --resume          # Resume from saved queue
```

## Related

- `/audit-project` command at `commands/audit-project.md`
- Reviewer spawn logic at `commands/audit-project-agents.md`
- GitHub issue creation at `commands/audit-project-github.md`
