/**
 * Tests for scripts/audit.js: the false-positive contract and the queue lifecycle.
 *
 * Run: `node --test tests/audit.test.js`
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.resolve(__dirname, '..', 'scripts', 'audit.js');
const { consolidate } = require(script);

const finding = (n, extra = {}) => ({ file: `src/f${n}.js`, line: n, severity: 'high', description: `issue ${n}`, ...extra });

test('a false-positive flag without a reason stays open', () => {
  const { items, summary } = consolidate([{ pass: 'security', findings: [
    finding(1, { falsePositive: true }),
    finding(2, { falsePositive: true, falsePositiveReason: '   ' }),
    finding(3, { falsePositive: true, falsePositiveReason: 'public cache key, not a secret' })
  ] }]);
  assert.equal(summary.open, 2);
  assert.equal(items.find(i => i.line === 1).reasonMissing, true);
  assert.equal(items.find(i => i.line === 3).status, 'false-positive');
});

test('more than half of 10+ findings flagged blocks the loop', () => {
  const findings = Array.from({ length: 10 }, (_, i) => finding(i, i < 6 ? { falsePositive: true, falsePositiveReason: 'ok' } : {}));
  const { summary } = consolidate([{ pass: 'code-quality', findings }]);
  assert.equal(summary.blocked, true);
  assert.match(summary.blockReason, /6\/10/);
  const few = consolidate([{ pass: 'code-quality', findings: findings.slice(0, 9) }]);
  assert.equal(few.summary.blocked, false, 'under 10 findings never blocks');
});

test('duplicates collapse and severity sorts critical first', () => {
  const { items } = consolidate([{ pass: 'perf', findings: [
    finding(1, { severity: 'low' }), finding(1, { severity: 'low' }), finding(2, { severity: 'critical' })
  ] }]);
  assert.equal(items.length, 2);
  assert.equal(items[0].severity, 'critical');
});

test('queue lifecycle: init, add, consolidate, strip, close', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-queue-'));
  const run = (args, input) => spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8', input });
  try {
    fs.mkdirSync(path.join(dir, '.claude'));
    const init = run(['queue-init', '--scope', 'src']);
    assert.equal(init.status, 0, init.stderr);
    const queue = init.stdout.trim();
    assert.ok(fs.existsSync(queue));

    const findings = Array.from({ length: 10 }, (_, i) => finding(i, { falsePositive: true, falsePositiveReason: 'said so' }));
    assert.equal(run(['add', queue, '--pass', 'security'], JSON.stringify({ pass: 'security', findings })).status, 0);
    assert.equal(run(['add', queue, '--pass', 'security'], 'not json').status, 1);
    assert.equal(run(['add', queue], JSON.stringify({ pass: 'security', findings })).status, 2, 'no --pass is refused');
    const spoof = run(['add', queue, '--pass', 'performance'], JSON.stringify({ pass: 'security', findings: [] }));
    assert.equal(spoof.status, 1, 'a result cannot claim another pass');

    const blocked = JSON.parse(run(['consolidate', queue]).stdout);
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.open, 0);

    const stripped = JSON.parse(run(['consolidate', queue, '--strip-false-positives']).stdout);
    assert.equal(stripped.open, 10);
    assert.equal(JSON.parse(run(['close', queue]).stdout).removed, false);

    assert.equal(run(['add', queue, '--pass', 'security'], JSON.stringify({ findings: [] })).status, 0);
    run(['consolidate', queue]);
    assert.equal(JSON.parse(run(['close', queue]).stdout).removed, true);
    assert.ok(!fs.existsSync(queue));

    assert.equal(run(['queue-init', '--scope', 'src', '--resume']).status, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
