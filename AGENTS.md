# audit-project

This repo is the audit-project plugin: multi-agent iterative code review that loops until no critical or high issues remain. Part of the [agentsys](https://github.com/agent-sh/agentsys) ecosystem; skills follow https://agentskills.io.

## Rules

- Output is plain text: no emojis or ASCII art. Status markers are `[OK]`, `[ERROR]`, `[WARN]`, `[CRITICAL]`.
- Commit only product files. Summaries, plans and audit notes belong in the PR or the conversation.
- A change is done when its tests pass; a feature or fix comes with a test that covers it.
- Non-trivial changes go through a PR, not a direct push to main. Run the git hooks; do not bypass them.
- In prose use ` - ` (single dash with spaces), not ` -- `.
- If a script fails, report the failure before doing the step by hand, so broken tooling gets fixed.
- Agent models: Opus for complex reasoning and planning, Sonnet for validation and most agents, Haiku for mechanical work.
- Priorities, in order: plugin users' experience, automation that needs no babysitting, token efficiency, output quality, simplicity.

## Reviewer contract

The REVIEWER CONTRACT block in `commands/audit-project-agents.md` is duplicated in the prepare-delivery plugin's [orchestrate-review skill](https://github.com/agent-sh/prepare-delivery/blob/main/skills/orchestrate-review/SKILL.md). When you edit either copy, update the other so they agree in intent; the wording may differ. Nothing checks this automatically.

## Layout

- `commands/audit-project.md`: the `/audit-project` command.
- `commands/audit-project-agents.md`: the review passes, the reviewer prompt and the queue.
- `commands/audit-project-github.md`: filing deferred findings as GitHub issues.
- `skills/audit-project/SKILL.md`: the skill that routes to the command.
- `scripts/audit.js`: project context and the review queue (`queue-init`, `add`, `consolidate`, `close`).

## Checks

```bash
npm test   # tests/audit.test.js
agnix .    # agent config lint (also runs in CI)
```

User-visible changes get a CHANGELOG entry under `[Unreleased]`.
