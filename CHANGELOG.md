# Changelog

## [Unreleased]

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
