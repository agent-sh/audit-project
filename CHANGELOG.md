# Changelog

## [Unreleased]

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
