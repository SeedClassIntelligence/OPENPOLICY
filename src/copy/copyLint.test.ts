import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const publicCopyFiles = [
  new URL('../../index.html', import.meta.url),
  new URL('../components/LandingPage.tsx', import.meta.url),
  new URL('./landing.ts', import.meta.url),
];

const applicationCopyFiles = [
  new URL('../App.tsx', import.meta.url),
  new URL('../components/AccountDashboard.tsx', import.meta.url),
  new URL('../components/AuthModal.tsx', import.meta.url),
  new URL('../components/Header.tsx', import.meta.url),
  new URL('../components/ConsumerPortal.tsx', import.meta.url),
  new URL('../components/ProviderPortal.tsx', import.meta.url),
  new URL('../components/AdminConsole.tsx', import.meta.url),
  new URL('../components/ArchitectureDocs.tsx', import.meta.url),
  new URL('../server/geminiService.ts', import.meta.url),
  new URL('../services/userService.ts', import.meta.url),
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

test('live interfaces do not restore retired marketplace or subjective offer language', () => {
  const retiredInterfaceLanguage = /policy challenge|consumer insurance competition|competition room|my competitions|challenge rating workspace|blind offers?|sealed blind|top parity savings|max savings|\bsaves \$|additional savings|better offer|best[- ]and[- ]final|improvement rounds?|counter[- ]?offers?|guaranteed savings|vault confidentiality guarantee|guarantees ledger/i;
  for (const url of applicationCopyFiles) {
    const source = readFileSync(url, 'utf8');
    const match = source.match(retiredInterfaceLanguage);
    assert.equal(match, null, `${fileURLToPath(url)} contains retired or unsupported interface wording: ${match?.[0]}`);
  }
});

test('public copy preserves the founder-approved operating boundaries', () => {
  const landing = readFileSync(new URL('../components/LandingPage.tsx', import.meta.url), 'utf8')
    + readFileSync(new URL('./landing.ts', import.meta.url), 'utf8');
  assert.match(landing, /current policy/i);
  assert.match(landing, /licensed providers?/i);
  assert.match(landing, /independently decide whether to send their own offers/i);
  assert.match(landing, /factual price and coverage differences/i);
  assert.match(landing, /keep your current policy/i);
  assert.match(landing, /licensed provider conducts the subsequent insurance transaction/i);
  assert.doesNotMatch(landing, /requirements you set|minimum price difference, maximum deductibles/i);
});
