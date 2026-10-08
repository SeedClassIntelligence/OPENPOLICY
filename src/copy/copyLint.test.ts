import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const publicCopyFiles = [
  new URL('../components/LandingPage.tsx', import.meta.url),
  new URL('./landing.ts', import.meta.url),
];

const applicationCopyFiles = [
  new URL('../components/AccountDashboard.tsx', import.meta.url),
  new URL('../components/AuthModal.tsx', import.meta.url),
  new URL('../components/Header.tsx', import.meta.url),
  new URL('../components/ConsumerPortal.tsx', import.meta.url),
  new URL('../components/ProviderPortal.tsx', import.meta.url),
  new URL('../components/AdminConsole.tsx', import.meta.url),
  new URL('../components/ArchitectureDocs.tsx', import.meta.url),
  new URL('../server/geminiService.ts', import.meta.url),
];

const prohibited = /compet|\bbid|auction|challeng|\bbeat\b|\bwin(?:ner|ning)?\b|\bforce\b|\bleads?\b|\brank|\bbest\b|\btop (?:five|5)\b|recommend|guarantee|\bcompliant\b|verified savings|\bsuperior\b|degraded|parity|anti-steering|certificates? of authority/i;

test('public landing-page copy avoids prohibited characterizations', () => {
  for (const url of publicCopyFiles) {
    const source = readFileSync(url, 'utf8');
    const match = source.match(prohibited);
    assert.equal(match, null, `${fileURLToPath(url)} contains prohibited public wording: ${match?.[0]}`);
  }
});

test('application copy never describes provider offers as bids or an auction', () => {
  const offerOnly = /\bbid(?:ding|s)?\b|\bauction(?:ed|ing|s)?\b/i;
  for (const url of applicationCopyFiles) {
    const source = readFileSync(url, 'utf8');
    const match = source.match(offerOnly);
    assert.equal(match, null, `${fileURLToPath(url)} contains auction-style wording: ${match?.[0]}`);
  }
});
