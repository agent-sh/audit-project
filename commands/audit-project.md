---
description: Multi-agent code review with iterative improvement
codex-description: 'Use when user asks to "review my code", "check for issues", "run code review", "analyze PR quality". Multi-agent iterative review that loops until all critical/high issues are resolved.'
argument-hint: "[scope] [--recent] [--domain AGENT] [--quick] [--create-tech-debt] [--resume]"
allowed-tools: Bash(git:*), Bash(node:*), Read, Write, Edit, Glob, Grep, Task, AskUserQuestion
---

# /audit-project - Multi-Agent Code Review

Comprehensive code review using specialized AI agents with iterative improvement.

## Quick Reference

| Phase | Description | Details |
|-------|-------------|---------|
| 1 | Context & Agent Selection | This file |
| 2 | Multi-Agent Review | See `audit-project-agents.md` |
| 3-4 | Tech Debt & Fixes | This file |
| 5-6 | Verification & Iteration | This file |
| 7 | Completion Report | This file |
| 8 | GitHub Issues | See `audit-project-github.md` |

## Arguments

Parse from $ARGUMENTS:
- **Scope**: Path to review (default: `.`) or `--recent` (last 5 commits only)
- **--domain AGENT**: Review with specific agent only (e.g., `--domain security`)
- **--quick**: Single pass, no iteration (fast feedback)
- **--create-tech-debt**: Force create/update TECHNICAL_DEBT.md
- **--resume**: Resume from existing review queue file

### Resume Mode

If `--resume` is provided, reuse the most recent review queue in the platform state dir.
Otherwise create a new queue file. See `audit-project-agents.md` for queue handling.

## Phase 1: Context Gathering

### Platform Detection

```bash
# Get plugin root using Node.js helper
PLUGIN_ROOT=$(node -e "const { getPluginRoot } = require('@agentsys/lib/cross-platform'); const root = getPluginRoot('audit-project'); if (!root) { console.error('Error: Could not locate audit-project plugin root'); process.exit(1); } console.log(root);")
PLATFORM=$(node "$PLUGIN_ROOT/lib/platform/detect-platform.js")
TOOLS=$(node "$PLUGIN_ROOT/lib/platform/verify-tools.js")

PROJECT_TYPE=$(echo $PLATFORM | jq -r '.projectType')
PACKAGE_MGR=$(echo $PLATFORM | jq -r '.packageManager')

# Detect framework
FRAMEWORK="unknown"
if [ "$PROJECT_TYPE" = "nodejs" ]; then
  [ -n "$(jq -e '.dependencies.react' package.json 2>/dev/null)" ] && FRAMEWORK="react"
  [ -n "$(jq -e '.dependencies.express' package.json 2>/dev/null)" ] && FRAMEWORK="express"
elif [ "$PROJECT_TYPE" = "python" ]; then
  grep -q "django" requirements.txt 2>/dev/null && FRAMEWORK="django"
  grep -q "fastapi" requirements.txt 2>/dev/null && FRAMEWORK="fastapi"
fi

RESUME_MODE=$([ "${ARGUMENTS}" != "${ARGUMENTS%--resume*}" ] && echo "true" || echo "false")
```

### Project Analysis

```bash
FILE_COUNT=$(git ls-files | wc -l)
TEST_FILES=$(git ls-files | grep -E '(test|spec)\.' | wc -l)
HAS_TESTS=$( [ "$TEST_FILES" -gt 0 ] && echo "true" || echo "false" )
HAS_DB=$(grep -rq -E "(Sequelize|Prisma|TypeORM)" . 2>/dev/null && echo "true" || echo "false")
HAS_API=$(grep -rq -E "(express|fastify|@nestjs)" . 2>/dev/null && echo "true" || echo "false")
HAS_FRONTEND=$( [ "$(git ls-files | grep -E '\.(tsx|jsx|vue|svelte)$' | wc -l)" -gt 0 ] && echo "true" || echo "false" )
HAS_BACKEND=$(grep -rq -E "(express|fastify|@nestjs|koa|hapi)" . 2>/dev/null && echo "true" || echo "false")
if [ -d ".github/workflows" ] || [ -f ".gitlab-ci.yml" ] || [ -f ".circleci/config.yml" ] || \
  [ -f "Jenkinsfile" ] || [ -f ".travis.yml" ] || [ -f "azure-pipelines.yml" ] || \
  [ -f "bitbucket-pipelines.yml" ]; then
  HAS_CICD="true"
else
  HAS_CICD="false"
fi
```

### Repo Intelligence (Optional)

Gather change-frequency signals from agent-analyzer if available. Files with high churn but no co-changing test file are highest-risk for review.

```javascript
// Gather repo-intel signals if available
const fs = require('fs');
const path = require('path');
let testGaps = [];
let painspots = [];
let bugspots = [];
let slopFixes = [];
let slopTargets = [];
let entryPoints = [];
try {
  const { binary } = require('@agentsys/lib');
  const cwd = process.cwd();
  const stateDir = ['.claude', '.opencode', '.codex'].find(d => fs.existsSync(path.join(cwd, d))) || '.claude';
  const mapFile = path.join(cwd, stateDir, 'repo-intel.json');
  if (fs.existsSync(mapFile)) {
    const json1 = binary.runAnalyzer(['repo-intel', 'query', 'test-gaps', '--top', '20', '--map-file', mapFile, cwd]);
    testGaps = JSON.parse(json1);
    const json2 = binary.runAnalyzer(['repo-intel', 'query', 'painspots', '--top', '10', '--map-file', mapFile, cwd]);
    painspots = JSON.parse(json2);
    const json3 = binary.runAnalyzer(['repo-intel', 'query', 'bugspots', '--top', '10', '--map-file', mapFile, cwd]);
    bugspots = JSON.parse(json3);
    // Slop-fixes: mechanical findings (empty catches, tautological
    // tests, passthrough wrappers, always-true conditions, commented-
    // out code, orphan exports, stale suppressions). Route the
    // code-quality-reviewer at files with concentrated slop first.
    // asArray: coerce any non-array result (an analyzer error object,
    // a missing nested property) to [] so the downstream for-of
    // loops never throw. Same guard the sync-docs and drift-detect
    // analyzer-queries collectors use.
    const asArray = (v) => Array.isArray(v) ? v : [];
    const slopRaw = JSON.parse(binary.runAnalyzer(['repo-intel', 'query', 'slop-fixes', '--map-file', mapFile, cwd]));
    slopFixes = Array.isArray(slopRaw) ? slopRaw : asArray(slopRaw?.fixes);
    // Slop-targets: Opus-tier cross-file clusters (wrapper towers,
    // single-impl traits, cliche name clusters, high-bug communities).
    // These are exactly the signals architecture-reviewer should focus
    // on — they describe structural issues per-file scans miss.
    const targetsRaw = JSON.parse(binary.runAnalyzer(['repo-intel', 'query', 'slop-targets', '--top', '30', '--map-file', mapFile, cwd]));
    slopTargets = Array.isArray(targetsRaw) ? targetsRaw : asArray(targetsRaw?.targets);
    // Entry-points: execution surfaces (Cargo [[bin]], main(),
    // framework configs). Used by devops-reviewer to understand the
    // CI/CD surface and by security-expert to identify exposed
    // attack surfaces.
    const epRaw = JSON.parse(binary.runAnalyzer(['repo-intel', 'query', 'entry-points', '--map-file', mapFile, cwd]));
    entryPoints = Array.isArray(epRaw) ? epRaw : asArray(epRaw?.entryPoints);
  }
} catch (e) { /* repo-intel not available, proceed without it */ }
```

If these arrays are non-empty, pass them to Phase 2 agents as priority context:

- **testGaps**: High-churn files with no co-changing test file - highest regression risk.
- **painspots**: Files ranked by `hotspot × complexity × bug density` - review most carefully.
- **bugspots**: Files with high bug-fix commit rate - fragile code, recommend extra test coverage.
- **slopFixes**: Mechanical slop findings. Group by file; high concentrations are priority targets for `code-quality-reviewer`.
- **slopTargets**: Cross-file structural slop (Opus tier). Route to `architecture-reviewer` — these describe patterns (wrapper towers, single-impl traits, cliche clusters) that per-file passes miss.
- **entryPoints**: Execution surfaces. Route to `devops-reviewer` (CI/CD impact) and `security-expert` (exposed attack surface).

Routing rules the orchestrator applies when queuing Phase 2 work:

| Signal concentrated in | Boost reviewer | Suppress reviewer |
|---|---|---|
| `slopFixes` by file (top 5) | `code-quality-reviewer` scans these first | — |
| `slopTargets` Opus tier | `architecture-reviewer` (force-enable if 3+ targets) | — |
| `entryPoints` in changed surface | `devops-reviewer` + `security-expert` priority | `frontend-specialist` deprioritized for pure-backend entry points |
| Every reviewer seeing a file with `stale-suppression` finding | — | Skip dead-code nits on that file; the finding already flags it |

```
Pain spots (files needing most scrutiny):
${painspots.map(p => `- \`${p.path}\` (pain=${p.painScore?.toFixed(2)}, bugRate=${p.bugFixRate?.toFixed(2)}, complexity=${p.complexityMax})`).join('\n') || 'None'}

High bug-fix density (review carefully):
${bugspots.map(b => `- \`${b.path}\` (${Math.round((b.bugFixRate || 0) * 100)}% of changes are bug fixes)`).join('\n') || 'None'}

Slop concentration (files with 3+ mechanical findings - code-quality priority, top 5):
${(() => {
  const counts = {};
  for (const f of slopFixes) {
    const p = f.action?.path;
    if (p) counts[p] = (counts[p] || 0) + 1;
  }
  const hot = Object.entries(counts).filter(([,n]) => n >= 3).sort((a,b) => b[1]-a[1]).slice(0, 5);
  return hot.length ? hot.map(([p,n]) => `- \`${p}\` (${n} findings)`).join('\n') : 'None';
})()}

Architectural slop targets (architecture-reviewer priority):
${slopTargets.filter(t => t.tier === 'opus').slice(0, 10).map(t => {
  const loc = t.kind === 'area' ? `[${(t.paths||[]).length} files]` : t.path;
  return `- \`${loc}\` — ${t.suspect}: ${t.why}`;
}).join('\n') || 'None'}

Execution surfaces in this audit (devops + security priority):
${entryPoints.slice(0, 15).map(ep => `- \`${ep.path}\` (${ep.kind}${ep.name ? `: ${ep.name}` : ''})`).join('\n') || 'None'}
```

### Agent Selection

**Always Active:**
- `code-quality-reviewer`: Code quality, error handling, maintainability
- `security-expert`: Security vulnerabilities, auth, input validation
- `performance-engineer`: Performance bottlenecks, algorithms, memory
- `test-quality-guardian`: Test coverage and quality (reports missing tests)

**Conditional:**
- `architecture-reviewer`: Design patterns (if `FILE_COUNT > 50`)
- `database-specialist`: Query optimization (if `HAS_DB=true`)
- `api-designer`: REST best practices (if `HAS_API=true`)
- `frontend-specialist`: Component design (if `HAS_FRONTEND=true`)
- `backend-specialist`: Service and domain logic (if `HAS_BACKEND=true`)
- `devops-reviewer`: CI/CD config (if `HAS_CICD=true`)

## Phase 2: Multi-Agent Review

See `audit-project-agents.md` for detailed agent coordination.

**Review queue:** Write findings to a temporary queue file in the platform state dir and keep it updated until all issues are resolved. Remove the file when the queue is empty.

### Finding Format (Required)

Every finding MUST include:
- **File:Line**: Exact location (e.g., `src/auth/session.ts:42`)
- **Severity**: critical | high | medium | low
- **Category**: From agent domain
- **Description**: What's wrong and why
- **Code Quote**: 1-3 lines showing issue
- **Suggested Fix**: Specific remediation
- **Effort**: small | medium | large

### Example Finding

```markdown
### Finding: Unsafe SQL Query
**Agent**: security-expert
**File**: src/api/users.ts:87
**Severity**: critical
**Code**:
```typescript
const query = `SELECT * FROM users WHERE id = ${userId}`;
```
**Fix**: Use parameterized queries.
**Effort**: small
```

## Phase 3: Tech Debt Documentation

If TECHNICAL_DEBT.md exists or `--create-tech-debt`:

```markdown
# Technical Debt

Last updated: $(date -I)

## Summary
**Total Issues**: X | Critical: Y | High: Z | Medium: A | Low: B

## Critical Issues
[Grouped by severity with file:line, description, fix, effort]

## Progress Tracking
- [ ] Issue 1
- [ ] Issue 2
```

## Phase 4: Automated Fixes

### Fix Strategy

1. **Auto-fixable** (lint, formatting): Apply directly
2. **Manual fix** (code logic): Implement suggested fix
3. **Design decision required**: Flag as blocked and report to user
4. **False positive**: Mark and remove from review queue

### Fix Order

1. Critical severity first
2. Then high → medium → low
3. Then by effort (small → large)
4. Then batch by file

## Phase 5: Verification

```bash
# Run tests
[ -n "$TEST_CMD" ] && $TEST_CMD
TEST_STATUS=$?

# Run linter
[ -n "$LINT_CMD" ] && $LINT_CMD
LINT_STATUS=$?

# Run build
[ -n "$BUILD_CMD" ] && $BUILD_CMD
BUILD_STATUS=$?

# Overall status
VERIFICATION_PASSED=$([ $TEST_STATUS -eq 0 ] && [ $LINT_STATUS -eq 0 ] && [ $BUILD_STATUS -eq 0 ] && echo "true" || echo "false")
```

### Handle Failures

If verification fails:
1. Review recent changes (`git diff`)
2. Identify breaking fix
3. Rollback: `git restore <file>`
4. Document as "fix caused regression"

## Phase 6: Iteration

```javascript
// initialAgentResults: raw agent outputs from Phase 2 (array of {pass, findings}).
// We keep raw results around so we can re-aggregate in place if the suspicious
// false-positive gate trips - mirrors prepare-delivery/orchestrate-review's
// pattern where "Treat flagged as open" strips flags on CURRENT results
// rather than re-spawning reviewers.
let agentResults = /* raw results from Phase 2 review */;
let consolidated = consolidateFindings(agentResults); // see audit-project-agents.md
let iteration = 1;
let remainingIssues = consolidated.all.filter(f => !f.falsePositive);

while (true) {
  // Suspicious false-positive ratio: escalate to user instead of auto-zeroing
  // the gate. Prevents a prompt-injected reviewer subagent from mass-marking
  // findings as falsePositive to bypass the severity counter. Must run BEFORE
  // the zero-issues exit check - otherwise a blocked result with all findings
  // flagged would slip through as "zero remaining".
  if (consolidated.blocked) {
    console.log(`[BLOCKED] ${consolidated.blockReason}`);
    const question = `Review loop blocked: ${consolidated.blockReason}. How should we proceed?`;
    const response = await AskUserQuestion({
      questions: [{
        question,
        header: 'Suspicious Reviewer Output',
        multiSelect: false,
        options: [
          { label: 'Treat flagged findings as open', description: 'Re-aggregate ignoring falsePositive flags and continue review loop' },
          { label: 'Override and approve', description: 'Trust the reviewer output as-is (risky)' },
          { label: 'Abort workflow', description: 'Stop here; human must inspect review queue manually' }
        ]
      }]
    });
    const choice = response.answers?.[question] ?? response[question];
    if (choice === 'Treat flagged findings as open') {
      // Strip falsePositive flags on the CURRENT raw agent results and
      // re-consolidate in place. Do NOT `continue` - that would fall back
      // to the top of the loop, which assumes consolidated is already set.
      // Falling through after reassigning lets the iteration proceed on the
      // corrected view without re-spawning reviewers.
      for (const r of agentResults) {
        for (const f of (r.findings || [])) {
          f.falsePositive = false;
          delete f.falsePositiveReason;
        }
      }
      consolidated = consolidateFindings(agentResults);
      remainingIssues = consolidated.all.filter(f => !f.falsePositive);
      // fall through to zero-issues check with re-aggregated view
    } else if (choice === 'Override and approve') {
      workflowState.completePhase({
        approved: true,
        iterations: iteration,
        suspicious: true,
        falsePositiveRatio: consolidated.falsePositiveRatio
      });
      break;
    } else {
      workflowState.failPhase(`Review blocked: ${consolidated.blockReason}`);
      break;
    }
  }

  if (remainingIssues.length === 0) {
    console.log("[OK] Zero issues remaining!");
    break;
  }

  const fixResult = applyFixes(remainingIssues);

  const verifyResult = runVerification();
  if (!verifyResult.passed) {
    rollbackFailed(fixResult);
  }

  // Re-review returns raw agent results (same shape as Phase 2) so we can
  // re-run consolidateFindings and get a fresh `blocked` signal for the
  // next iteration.
  agentResults = reReview(fixResult.changedFiles);
  consolidated = consolidateFindings(agentResults);
  remainingIssues = consolidated.all.filter(f => !f.falsePositive);

  iteration++;
}
```

### Quick Mode

If `--quick` flag: Single pass, findings only, no fixes.

## Phase 6.5: Decision Gate (User)

After each iteration (or after re-review if issues remain), report the queue state and ask the user what to do next.

```javascript
const openCount = remainingIssues.length;
console.log(`Open issues: ${openCount}`);
console.log(`Queue file: ${reviewQueuePath}`); // set in Phase 2 (audit-project-agents)

const decision = await AskUserQuestion({
  questions: [{
    header: "Audit Decision",
    question: "Review queue still open. What next?",
    options: [
      { label: "Continue review", description: "Run another iteration" },
      { label: "Create issues", description: "Stop and create issues" },
      { label: "Update tech debt", description: "Stop and update TECHNICAL_DEBT.md" },
      { label: "Leave queue", description: "Stop and keep queue for resume" }
    ],
    multiSelect: false
  }]
});

const choice = decision[0];
if (choice === 'Continue review') {
  // continue loop
} else if (choice === 'Create issues') {
  // Create issues and remove queue file
} else if (choice === 'Update tech debt') {
  // Update TECHNICAL_DEBT.md and remove queue file
} else if (choice === 'Leave queue') {
  // Leave queue file for --resume
  break;
}
```

## Phase 7: Completion Report

```markdown
# Project Review Complete

**Scope**: ${SCOPE} | **Framework**: ${FRAMEWORK}
**Iterations**: ${iteration} | **Duration**: ${duration}

## Summary
**Issues Found**: ${initialCount}
**Issues Fixed**: ${fixedCount}
**Remaining**: ${remainingCount}

## By Severity
- Critical: ${criticalFound} → ${criticalRemaining}
- High: ${highFound} → ${highRemaining}
- Medium: ${mediumFound} → ${mediumRemaining}
- Low: ${lowFound} → ${lowRemaining}

## Verification
- Tests: [OK]/[FAIL]
- Linter: [OK]/[FAIL]
- Build: [OK]/[FAIL]

## Files Changed
${FILE_COUNT} files modified

## Remaining Issues
[List of issues needing attention]
```

## Phase 8: GitHub Issue Creation

See `audit-project-github.md` for:
- Creating GitHub issues for deferred items
- Security issue handling (no public issues)
- TECHNICAL_DEBT.md cleanup

## Error Handling

### No Framework Detected
```
Framework detection failed, using generic patterns.
```

### No Tests Available
```
No test suite detected. Skipping test-quality-guardian.
```

### All Agents Failed
```
ERROR: All review agents failed.
Try: --recent or specific path for smaller scope.
```

## Usage Examples

```bash
/audit-project                    # Full review
/audit-project --recent           # Last 5 commits only
/audit-project src/api            # Specific path
/audit-project --domain security  # Security audit only
/audit-project --quick            # Fast feedback, no fixes
/audit-project --create-tech-debt # Force tech debt file
```

## Success Criteria

- [OK] All agents completed review
- [OK] Evidence-based findings (file:line provided)
- [OK] Critical issues fixed or documented
- [OK] Verification passes
- [OK] TECHNICAL_DEBT.md updated (if enabled)

Begin Phase 1 now.
