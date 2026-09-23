# Changelog

## [Unreleased]

## [1.2.0] - 2026-09-24

### Added
- `scripts/audit.js`: `context` (project type, framework, DB/API/frontend/backend/CI signals, repo-intel lists) and the review queue (`queue-init`, `add`, `consolidate`, `close`). The command described all of this as JavaScript and shell for the model to act out.
- `tests/audit.test.js` and an `npm test` script (the package had none, so CI ran nothing).

### Changed
- Rewrote `/audit-project`, its two reference commands and the skill for current models: goal, constraints with reasons and a definition of done per step, in place of phase pseudocode.
- The false-positive contract is enforced by `consolidate` in code: a dismissal needs a reason, and more than half of 10+ findings dismissed sets `blocked`. The reviewer-facing contract text is unchanged in intent and kept in sync with prepare-delivery.
- Reviewers no longer write the queue file themselves. They return JSON and `add` stores it, so parallel passes cannot corrupt the file.
- Reviewer passes spawn a `general-purpose` agent in Claude Code. The old `subagent_type: "review"` named an agent type that does not exist.
- Framework detection ignores docs and lockfiles and covers more frameworks; `node_modules` no longer counts.
- Removed the framework regex tables and `applyPatterns`, which only attached a label to findings.

### Fixed
- Issue creation runs only when the user picks it, and the titles are shown first. Without AskUserQuestion the loop never files issues.
- The final commit names the files the audit changed instead of `git add -A`, which swept the user's unrelated uncommitted work into the commit.
- Fix rollback restores the file that broke verification by name and warns about files that already had uncommitted changes.

## [1.1.0] - 2026-09-23

### Changed
- Skill description cut to one trigger sentence (under 40 words) so Codex does not truncate it.
- `/audit-project` states defaults for harnesses without `Task` or `AskUserQuestion` (Codex, OpenCode): review passes run sequentially, a blocked loop treats flagged findings as open, and the decision gate continues while critical/high issues remain (up to 5 iterations), then leaves the queue.
- Review passes no longer point at prepare-delivery's `orchestrate-review` as a required source.
- All-caps wording dropped where it was not a safety constraint. The rule that security findings stay out of public issues keeps its reason.

## [1.0.2] - 2026-04-26

### Security
- **Orchestrator now handles `consolidateFindings.blocked` signal** (#27). Mirrors prepare-delivery's 3-option escalation: treat flagged as open (re-aggregate in place), override and approve, or abort. Closes the gap where a suspicious reviewer output was blocked at aggregation but the orchestrator ignored the flag.

### Docs
- REVIEWER-CONTRACT marker comments + drift-sync note in CLAUDE.md (#28).

## [1.0.1] - 2026-04-26

### Security

- consolidateFindings mirrors prepare-delivery's false-positive sanity cap (50% ratio + falsePositiveReason requirement). Callers must check the new blocked signal — wiring the orchestrator is a follow-up.

### Added

- Wire painspots and bugspots into review prioritization - Phase 1 queries top 10 painspots (hotspot × complexity × bug density) and top 10 bugspots from agent-analyzer and passes them to Phase 2 review agents as priority context
- Test-gaps prioritization from repo-intel: high-churn files with no co-changing test file surfaced to reviewers
- `agent-knowledge` as git submodule, making research guides available to review agents

### Changed

- Upgrade README with review agents table, iteration loop diagram, and severity classification guide

### Fixed

- Remove AUTO-GENERATED comment and redundant 'Be concise' instruction from agent prompts

### CI

- Add agnix validation to CI pipeline
- Add shared CI workflows, Claude Code review, and git hooks

## [1.0.0] - 2026-02-21

Initial release. Extracted from [agentsys](https://github.com/agent-sh/agentsys) monorepo.
