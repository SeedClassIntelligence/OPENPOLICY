/**
 * Validator: Baseline Semantic Corrections — Jurisdiction Assumption Removal (D6)
 *
 * Runs the D6 domain suite (src/domain/semanticCorrections.test.ts) and fails
 * with a non-zero exit code if any assertion fails.
 */

// Must stay the first import: isolates this suite's database before any store is constructed.
import './lib/isolatedDataDir';
import { runSemanticCorrectionsTestSuite } from '../src/domain/semanticCorrections.test';

const suite = runSemanticCorrectionsTestSuite();

console.log('\n================================================================');
console.log('OPEN POLICY — D6 BASELINE SEMANTIC CORRECTIONS VALIDATION');
console.log('================================================================\n');
for (const r of suite.results) {
  console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] ${r.name}${!r.passed && r.details ? `\n         ${r.details}` : ''}`);
}
console.log(`\nD6 VALIDATION SUMMARY: ${suite.passed} / ${suite.total} PASSED`);
process.exit(suite.failed === 0 ? 0 : 1);
