#!/usr/bin/env node
// audit.js - project context and review-queue bookkeeping for /audit-project
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const lib = path.join(__dirname, '..', 'lib');

const USAGE = `usage:
  audit.js context [scope]                  project facts and repo-intel signals as JSON
  audit.js queue-init --scope S [--resume]  create (or with --resume, reopen the latest) queue; prints its path
  audit.js add <queue> --pass ID [file]     store one reviewer result ({pass, findings}) from file or stdin
  audit.js consolidate <queue> [--strip-false-positives]
                                            dedupe, sort and count findings; enforce the false-positive contract
  audit.js close <queue>                    delete the queue if no open findings remain
`;

function fail(msg, code = 2) {
  process.stderr.write(`${msg}\n`);
  process.exit(code);
}

function out(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function writeJson(file, obj) {
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}

function stateDirPath(cwd) {
  try {
    return require(path.join(lib, 'platform', 'state-dir')).getStateDirPath(cwd);
  } catch {
    const found = ['.claude', '.opencode', '.codex'].find(d => fs.existsSync(path.join(cwd, d)));
    return path.join(cwd, found || '.claude');
  }
}

// ---------------------------------------------------------------- context

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function trackedMatches(pattern, cwd) {
  // git grep searches tracked files only, so node_modules and build output never count.
  try {
    // Docs and lockfiles mention frameworks without using them.
    execFileSync('git', ['grep', '-q', '-E', pattern, '--', '.', ':!*.md', ':!*.txt', ':!*.lock', ':!*-lock.json'], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function detectFramework(projectType, cwd) {
  if (projectType === 'nodejs') {
    const pkg = readJson(path.join(cwd, 'package.json')) || {};
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const name of ['next', 'react', 'vue', 'svelte', '@nestjs/core', 'express', 'fastify', 'koa']) {
      if (deps[name]) return name.replace('@nestjs/core', 'nestjs');
    }
  } else if (projectType === 'python') {
    const req = ['requirements.txt', 'pyproject.toml']
      .map(f => { try { return fs.readFileSync(path.join(cwd, f), 'utf8'); } catch { return ''; } })
      .join('\n').toLowerCase();
    for (const name of ['django', 'fastapi', 'flask']) if (req.includes(name)) return name;
  }
  return 'unknown';
}

function repoIntelSignals(cwd) {
  const mapFile = path.join(stateDirPath(cwd), 'repo-intel.json');
  if (!fs.existsSync(mapFile)) return { available: false, reason: 'repo-intel map not found' };
  let q;
  try { q = require(path.join(lib, 'repo-intel', 'queries')); } catch (e) {
    return { available: false, reason: e.message };
  }
  const asArray = (v, key) => (Array.isArray(v) ? v : Array.isArray(v && v[key]) ? v[key] : []);
  const safe = fn => { try { return fn(); } catch { return null; } };

  const slopFixes = asArray(safe(() => q.slopFixes(cwd)), 'fixes');
  const perFile = {};
  for (const f of slopFixes) {
    const p = f.action && f.action.path;
    if (!p) continue;
    perFile[p] = perFile[p] || { path: p, count: 0, categories: new Set() };
    perFile[p].count++;
    if (f.category) perFile[p].categories.add(f.category);
  }
  const slopHotFiles = Object.values(perFile)
    .filter(f => f.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(f => ({ path: f.path, count: f.count, categories: [...f.categories] }));

  return {
    available: true,
    testGaps: asArray(safe(() => q.testGaps(cwd, { limit: 20 }))),
    painspots: asArray(safe(() => q.painspots(cwd, { limit: 10 }))),
    bugspots: asArray(safe(() => q.bugspots(cwd, { limit: 10 }))),
    slopHotFiles,
    slopTargets: asArray(safe(() => q.slopTargets(cwd, { top: 30 })), 'targets')
      .filter(t => t.tier === 'opus').slice(0, 10),
    entryPoints: asArray(safe(() => q.entryPoints(cwd)), 'entryPoints').slice(0, 15)
  };
}

async function cmdContext(scope) {
  const cwd = process.cwd();
  let platform = {};
  try {
    const out = execFileSync(process.execPath, [path.join(lib, 'platform', 'detect-platform.js')], { cwd, encoding: 'utf8' });
    platform = JSON.parse(out);
  } catch { /* detection is best effort */ }

  const files = (git(['ls-files'], cwd) || '').split('\n').filter(Boolean);
  const projectType = platform.projectType || 'unknown';
  const backend = '(express|fastify|@nestjs|koa|hapi|django|fastapi|flask|gin-gonic|actix|axum)';
  const ctx = {
    scope: scope || '.',
    projectType,
    packageManager: platform.packageManager || null,
    framework: detectFramework(projectType, cwd),
    fileCount: files.length,
    hasTests: files.some(f => /(^|\/)(tests?|__tests__|spec)\/|[._-](test|spec)\.[a-z]+$/i.test(f)),
    hasDb: trackedMatches('(Sequelize|Prisma|TypeORM|mongoose|SQLAlchemy|knex|drizzle)', cwd),
    hasApi: trackedMatches(backend, cwd),
    hasBackend: trackedMatches(backend, cwd),
    hasFrontend: files.some(f => /\.(tsx|jsx|vue|svelte)$/.test(f)),
    hasCicd: ['.github/workflows', '.gitlab-ci.yml', '.circleci/config.yml', 'Jenkinsfile', '.travis.yml',
      'azure-pipelines.yml', 'bitbucket-pipelines.yml'].some(p => fs.existsSync(path.join(cwd, p))),
    repoIntel: repoIntelSignals(cwd)
  };
  out(ctx);
}

// ---------------------------------------------------------------- queue

function newQueue(scope) {
  return { status: 'open', scope: { type: 'audit', value: scope }, results: [], items: [], iteration: 0, updatedAt: new Date().toISOString() };
}

function latestQueue(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter(n => n.startsWith('review-queue-') && n.endsWith('.json'))
    .map(n => ({ p: path.join(dir, n), t: fs.statSync(path.join(dir, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files.length ? files[0].p : null;
}

function cmdQueueInit(args) {
  const i = args.indexOf('--scope');
  const scope = i >= 0 ? args[i + 1] : '.';
  const dir = stateDirPath(process.cwd());
  fs.mkdirSync(dir, { recursive: true });
  if (args.includes('--resume')) {
    const found = latestQueue(dir);
    if (found) {
      const q = readJson(found) || newQueue(scope);
      q.status = 'open';
      q.resumedAt = q.updatedAt = new Date().toISOString();
      writeJson(found, q);
      process.stdout.write(`${found}\n`);
      return;
    }
  }
  const file = path.join(dir, `review-queue-${Date.now()}.json`);
  writeJson(file, newQueue(scope));
  process.stdout.write(`${file}\n`);
}

function loadQueue(file) {
  if (!file) fail(USAGE);
  const q = readJson(file);
  if (!q) fail(`queue unreadable: ${file}`, 1);
  q.results = Array.isArray(q.results) ? q.results : [];
  return q;
}

function cmdAdd(file, args) {
  const i = args.indexOf('--pass');
  // The orchestrator names the pass. The id inside the result comes from a reviewer that read
  // untrusted code, so it may confirm the slot but never choose it.
  const pass = i >= 0 ? args[i + 1] : null;
  if (!pass || pass.startsWith('--')) fail('add needs --pass <id> for the pass that produced this result');
  const src = args.filter((a, j) => j !== i && j !== i + 1)[0];
  const q = loadQueue(file);
  const text = src ? fs.readFileSync(src, 'utf8') : fs.readFileSync(0, 'utf8');
  let result;
  try { result = JSON.parse(text); } catch { fail('reviewer result is not valid JSON', 1); }
  if (!result || typeof result !== 'object' || !Array.isArray(result.findings)) {
    fail('reviewer result needs {"pass": "...", "findings": [...]}', 1);
  }
  if (result.pass !== undefined && String(result.pass) !== pass) {
    fail(`result says pass "${result.pass}" but was added as "${pass}"; not stored`, 1);
  }
  // A pass re-run after fixes replaces its earlier result.
  q.results = q.results.filter(r => r.pass !== pass).concat([{ pass, findings: result.findings }]);
  q.updatedAt = new Date().toISOString();
  writeJson(file, q);
  out({ pass, findings: result.findings.length, passes: q.results.map(r => r.pass) });
}

const SEVERITY = { critical: 0, high: 1, medium: 2, low: 3 };

// The false-positive contract: a flag counts only with a non-empty reason, and more than half of
// 10+ findings flagged means a reviewer may have been steered by the code it read.
function consolidate(results) {
  const seen = new Set();
  const items = [];
  for (const r of results) {
    for (const f of r.findings || []) {
      const reason = typeof f.falsePositiveReason === 'string' ? f.falsePositiveReason.trim() : '';
      const falsePositive = f.falsePositive === true && reason.length > 0;
      const id = `${r.pass}:${f.file}:${f.line}:${f.description}`;
      if (seen.has(id)) continue;
      seen.add(id);
      // Computed fields go last so a finding cannot relabel its own id or pass.
      items.push({
        ...f,
        id,
        pass: r.pass,
        falsePositive,
        falsePositiveReason: reason || undefined,
        reasonMissing: f.falsePositive === true && reason.length === 0,
        status: falsePositive ? 'false-positive' : 'open'
      });
    }
  }
  items.sort((a, b) => (SEVERITY[a.severity] ?? 99) - (SEVERITY[b.severity] ?? 99));
  const open = items.filter(f => !f.falsePositive);
  const flagged = items.length - open.length;
  const ratio = items.length ? flagged / items.length : 0;
  const blocked = items.length >= 10 && ratio > 0.5;
  const count = sev => open.filter(f => f.severity === sev).length;
  return {
    items,
    summary: {
      total: items.length,
      open: open.length,
      counts: { critical: count('critical'), high: count('high'), medium: count('medium'), low: count('low') },
      markedFalsePositive: flagged,
      falsePositiveRatio: Number(ratio.toFixed(3)),
      blocked,
      blockReason: blocked
        ? `reviewers marked ${flagged}/${items.length} findings (${Math.round(ratio * 100)}%) as false positive; a human has to decide`
        : null
    }
  };
}

function cmdConsolidate(file, args) {
  const q = loadQueue(file);
  if (args.includes('--strip-false-positives')) {
    for (const r of q.results) for (const f of r.findings || []) { f.falsePositive = false; delete f.falsePositiveReason; }
  }
  const { items, summary } = consolidate(q.results);
  q.items = items;
  q.passes = q.results.map(r => r.pass);
  q.updatedAt = new Date().toISOString();
  writeJson(file, q);
  const byFile = {};
  for (const f of items.filter(i => !i.falsePositive)) byFile[f.file] = (byFile[f.file] || 0) + 1;
  out({ queue: file, ...summary, topFiles: Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 10) });
}

function cmdClose(file) {
  const q = loadQueue(file);
  const open = (q.items || []).filter(i => !i.falsePositive).length;
  if (open === 0) {
    fs.rmSync(file, { force: true });
    out({ queue: file, removed: true, open });
  } else {
    out({ queue: file, removed: false, open });
  }
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case 'context': return cmdContext(args[0]);
    case 'queue-init': return cmdQueueInit(args);
    case 'add': return cmdAdd(args[0], args.slice(1));
    case 'consolidate': return cmdConsolidate(args[0], args.slice(1));
    case 'close': return cmdClose(args[0]);
    default: fail(USAGE);
  }
}

if (require.main === module) {
  main().catch(err => fail(`audit.js: ${err.message}`, 1));
}

module.exports = { consolidate };
