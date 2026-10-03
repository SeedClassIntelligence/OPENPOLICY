/**
 * Baseline regression runner (D11).
 *
 * Runs every validator as its own process, sequentially, with a per-suite
 * timeout. Each validator isolates its own database (scripts/lib/isolatedDataDir),
 * so the result must not depend on order. This runner exists to demonstrate that.
 *
 * Usage:
 *   tsx scripts/run-validators.ts                    # canonical order
 *   tsx scripts/run-validators.ts --order reverse
 *   tsx scripts/run-validators.ts --order shuffle --seed 42
 *   tsx scripts/run-validators.ts --only ce3,ce5 --repeat 2
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const SUITES = ['pm1', 'pm2', 'pm3', 'pm4', 'pm5', 'commercial-economics', 'ce3', 'ce4', 'ce5'];
const TIMEOUT_MS = 300_000;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// Deterministic PRNG (mulberry32) so a shuffled order is reproducible from its seed.
function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let suites = arg('only') ? arg('only')!.split(',') : [...SUITES];
const order = arg('order') || 'canonical';
if (order === 'reverse') suites.reverse();
if (order === 'shuffle') {
  const rand = seededRandom(Number(arg('seed') || Date.now()));
  for (let i = suites.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [suites[i], suites[j]] = [suites[j], suites[i]];
  }
}
const repeat = Number(arg('repeat') || 1);
const runList = Array.from({ length: repeat }, () => suites).flat();

const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpolicy-validator-logs-'));
console.log(`Order: ${order}${arg('seed') ? ` (seed ${arg('seed')})` : ''} -> ${runList.join(', ')}`);
console.log(`Logs: ${logDir}\n`);

let failures = 0;
for (const [n, suite] of runList.entries()) {
  const script = path.join('scripts', `validate-${suite}.ts`);
  const started = Date.now();
  const result = spawnSync(process.execPath, ['--import', 'tsx', script], {
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    maxBuffer: 64 * 1024 * 1024
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  fs.writeFileSync(path.join(logDir, `${String(n + 1).padStart(2, '0')}-${suite}.log`), output);

  const passCount = (output.match(/\[PASS\]|✓|✅/g) || []).length;
  const failCount = (output.match(/\[FAIL\]|✗|❌/g) || []).length;
  const summary =
    output.split('\n').filter(l => /\d+ ?\/ ?\d+|out of \d+/.test(l)).pop()?.trim() || '(no summary line)';
  const timedOut = result.error && (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT';
  const ok = result.status === 0 && failCount === 0 && !timedOut;
  if (!ok) failures++;

  const status = timedOut ? 'TIMEOUT' : ok ? 'PASS' : 'FAIL';
  console.log(
    `${status.padEnd(7)} ${suite.padEnd(21)} exit=${String(result.status).padEnd(4)} ` +
      `assertions ${passCount} pass / ${failCount} fail  ${((Date.now() - started) / 1000).toFixed(1)}s  | ${summary}`
  );
}

console.log(`\n${failures === 0 ? 'ALL SUITES PASS' : `${failures} SUITE RUN(S) FAILED`} (${runList.length} runs)`);
process.exit(failures === 0 ? 0 : 1);
