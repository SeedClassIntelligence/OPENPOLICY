import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const publicCopyFiles = [
  new URL('../components/LandingPage.tsx', import.meta.url),
  new URL('./landing.ts', import.meta.url),
];

const prohibited = /compet|\bbid|auction|challeng|\bbeat\b|\bwin(?:ner|ning)?\b|\bforce\b|\bleads?\b|\brank|\bbest\b|\btop (?:five|5)\b|recommend|guarantee|\bcompliant\b|verified savings|\bsuperior\b|degraded|parity|anti-steering|certificates? of authority/i;

test('public landing-page copy avoids prohibited characterizations', () => {
  for (const url of publicCopyFiles) {
    const source = readFileSync(url, 'utf8');
    const match = source.match(prohibited);
    assert.equal(match, null, `${fileURLToPath(url)} contains prohibited public wording: ${match?.[0]}`);
  }
});
