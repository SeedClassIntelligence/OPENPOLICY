/**
 * Validator database isolation (baseline stabilization, D11).
 *
 * Every validator imports this module first. It points OPENPOLICY_DATA_DIR at
 * a fresh, empty temporary directory before the module-level postgresStore and
 * commercialStore singletons are constructed. Each suite therefore starts from
 * an empty database and must establish its own prerequisites, so its result
 * cannot depend on which suites ran before it.
 *
 * The directory is removed when the process exits.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const suiteName = path.basename(process.argv[1] || 'validator').replace(/\.[cm]?[jt]s$/, '');

export const ISOLATED_DATA_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), `openpolicy-${suiteName}-`));

process.env.OPENPOLICY_DATA_DIR = path.join(ISOLATED_DATA_ROOT, 'openpolicy_pg');
process.env.OPENPOLICY_AUTH_MODE = 'fixture';
// Canonical validators predate Firebase identities and exercise domain behavior.
// This explicit process-only switch preserves those fixtures; it is forbidden by
// configuredAuthMode when NODE_ENV=production and cannot be request-controlled.
process.env.OPENPOLICY_FIXTURE_AUTHORIZATION_BYPASS = '1';

process.on('exit', () => {
  try {
    fs.rmSync(ISOLATED_DATA_ROOT, { recursive: true, force: true });
  } catch {
    // Best effort: an orphaned temp directory cannot affect another run.
  }
});
