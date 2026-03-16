# audit-project

Multi-agent iterative code review that loops until zero issues remain.

## Why

Manual code reviews miss things. Single-pass automated reviews find issues but leave fixing to you. audit-project runs up to 10 specialized review agents, fixes the issues it finds, re-reviews the fixes, and repeats until the codebase is clean - or you tell it to stop.

Use it when you want:

- A thorough review before a release or major merge
- Security-focused auditing of a specific area
- Quick feedback on recent commits
- Automated cleanup of accumulated code quality issues

## Installation

```bash
agentsys install audit-project
```

Requires [agentsys](https://github.com/agent-sh/agentsys) as the plugin runtime.

## Quick Start

```bash
/audit-project              # Full iterative review of the entire project
/audit-project --quick      # Single pass, findings only, no fixes
/audit-project --recent     # Review last 5 commits only
```

## How It Works

1. **Context gathering** - Detects project type, framework, languages, and infrastructure (DB, API, CI/CD, frontend/backend).
2. **Agent selection** - Activates 4 core agents plus up to 6 conditional agents based on what the project contains.
3. **Multi-agent review** - Each agent reviews only the files relevant to its domain and produces structured findings with file:line locations, severity, and suggested fixes.
4. **Automated fixes** - Applies fixes in severity order (critical first), batched by file. Rolls back any fix that breaks tests or build.
5. **Re-review** - Runs agents again on changed files. If new issues appear, fixes and re-reviews again.
6. **Decision gate** - After each iteration, reports remaining issues and asks whether to continue, create GitHub issues, update TECHNICAL_DEBT.md, or save the queue for later.

### Review Agents

**Always active:**

| Agent | Focus |
|-------|-------|
| code-quality-reviewer | Error handling, maintainability, code patterns |
| security-expert | Vulnerabilities, auth, input validation |
| performance-engineer | Bottlenecks, algorithms, memory usage |
| test-quality-guardian | Test coverage gaps, test quality |

**Conditional (activated by project signals):**

| Agent | Activated when |
|-------|---------------|
| architecture-reviewer | 50+ tracked files |
| database-specialist | Sequelize, Prisma, or TypeORM detected |
| api-designer | Express, Fastify, or NestJS detected |
| frontend-specialist | .tsx, .jsx, .vue, or .svelte files present |
| backend-specialist | Server framework detected |
| devops-reviewer | CI/CD configuration files present |

### Finding Format

Every finding includes file:line location, severity (critical/high/medium/low), a code quote, a suggested fix, and an effort estimate (small/medium/large).

## Usage

```bash
/audit-project                      # Full iterative review
/audit-project src/api              # Review a specific path
/audit-project --domain security    # Run only the security-expert agent
/audit-project --quick              # Single pass, no fixes applied
/audit-project --recent             # Scope to last 5 commits
/audit-project --create-tech-debt   # Force TECHNICAL_DEBT.md creation
/audit-project --resume             # Resume from a saved review queue
```

### Repo Intelligence

When [agent-analyzer](https://github.com/agent-sh/agent-analyzer) repo-intel data is available, audit-project uses test-gap signals to prioritize review. Files with high churn but no co-changing test file receive extra scrutiny.

## Requirements

- [agentsys](https://github.com/agent-sh/agentsys) runtime
- Git repository
- Works with Claude Code, OpenCode, Codex, and Cursor

## Related Plugins

- [enhance](https://github.com/agent-sh/enhance) - Plugin structure and config analysis
- [perf](https://github.com/agent-sh/perf) - Dedicated performance investigation with profiling
- [repo-map](https://github.com/agent-sh/repo-map) - AST-based repository map for deeper code understanding
- [ship](https://github.com/agent-sh/ship) - PR workflow from commit to production

## License

MIT
