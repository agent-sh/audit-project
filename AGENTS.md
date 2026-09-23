# audit-project

> Multi-agent iterative code review until zero issues remain

## Commands

- audit-project-agents
- audit-project-github
- audit-project

## Critical Rules

1. **Plain text output** - No emojis, no ASCII art. Use `[OK]`, `[ERROR]`, `[WARN]`, `[CRITICAL]` for status markers.
2. **No unnecessary files** - Don't create summary files, plan files, audit files, or temp docs.
3. **Task is not done until tests pass** - Every feature/fix must have quality tests.
4. **Create PRs for non-trivial changes** - No direct pushes to main.
5. **Always run git hooks** - Never bypass pre-commit or pre-push hooks.
6. **Use single dash for em-dashes** - In prose, use ` - ` (single dash with spaces), never ` -- `.
7. **Report script failures before manual fallback** - Never silently bypass broken tooling.
8. **Token efficiency** - Save tokens over decorations.
9. **Reviewer contract sync** - The REVIEWER CONTRACT block in `commands/audit-project-agents.md` is duplicated in `prepare-delivery/skills/orchestrate-review/SKILL.md`. When editing either block, update both. They must agree in intent; wording differs slightly. No tool enforces this today; a CI check is a known follow-up.

## Model Selection

| Model | When to Use |
|-------|-------------|
| **Opus** | Complex reasoning, analysis, planning |
| **Sonnet** | Validation, pattern matching, most agents |
| **Haiku** | Mechanical execution, no judgment needed |

## Core Priorities

1. User DX (plugin users first)
2. Worry-free automation
3. Token efficiency
4. Quality output
5. Simplicity

## Dev Commands

```bash
npm test          # Run tests
npm run validate  # All validators
```

## References

- Part of the [agentsys](https://github.com/agent-sh/agentsys) ecosystem
- https://agentskills.io
