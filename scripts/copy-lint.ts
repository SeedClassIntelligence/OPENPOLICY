import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const pattern = /policy challenge|consumer insurance competition|competition room|my competitions|challenge rating workspace|blind offers?|sealed blind|top parity savings|max savings|\bsaves \$|additional savings|better offer|best[- &]?and[- ]?final|improvement rounds?|counter[- ]?offers?|guaranteed savings|vault confidentiality guarantee|guarantees ledger|requirements you set|your requirements|minimum price difference, maximum deductibles|no competitive market|price concession|anti-steering|section 40 parity|\bcompliant\b|\bbid(?:ding|s)?\b|\bauction(?:ed|ing|s)?\b/i;
const excluded = /\.test\.(?:ts|tsx)$/;
const files = globSync(['src/components/**/*.tsx', 'src/copy/**/*.{ts,tsx}', 'index.html'], { exclude: file => excluded.test(file) });
let findings = 0;
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(pattern);
    if (!match) return;
    findings += 1;
    console.log(`${file}:${index + 1}: matched "${match[0]}" in "${line.trim()}"`);
  });
}
console.log(`Copy lint report: ${findings} finding(s).`);
if (!process.argv.includes('--report-only') && findings > 0) process.exitCode = 1;
