import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const pattern = /compet|\bbid|auction|challeng|\bbeat\b|\bwin(?:ner|ning)?\b|\bforce\b|\bleads?\b|\brank|\bbest\b|\btop (?:five|5)\b|recommend|guarantee|\bcompliant\b|verified savings|\bsuperior\b|degraded|parity|anti-steering|certificates? of authority|\bsavings?\b|\bdeals?\b|\brounds?\b|best (?:&|and) final|\bbafo\b|improvement (?:round|window)|negotiat|counter-?(?:offer|propos)|sharpen|your (?:terms|requirements)|set your|minimum savings|most competitive|\bcheapest\b|\bsave \$/i;
const excluded = /(?:AdminConsole|ArchitectureDocs|\.test)\.(?:ts|tsx)$/;
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
