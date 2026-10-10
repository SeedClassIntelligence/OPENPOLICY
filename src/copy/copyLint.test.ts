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

test('consumer and provider interfaces use factual review labels rather than legacy challenge or superiority language', () => {
  const consumer = readFileSync(new URL('../components/ConsumerPortal.tsx', import.meta.url), 'utf8');
  const provider = readFileSync(new URL('../components/ProviderPortal.tsx', import.meta.url), 'utf8');
  for (const source of [consumer, provider]) {
    assert.doesNotMatch(source, /Economic & Protection Benchmark|Material Protection Upgrade|PROMINENT WARNING: Coverage Cut|significantly reduced|>CHALLENGE #/i);
  }
  assert.match(consumer, /Current Policy Reference/);
  assert.match(consumer, /Additional Stated Coverage/);
  assert.match(consumer, /This lower-priced offer states these coverage differences/);
});

test('consumer policy verification visibly presents the extracted policy term', () => {
  const consumer = readFileSync(new URL('../components/ConsumerPortal.tsx', import.meta.url), 'utf8');
  assert.match(consumer, /Policy Term/);
  assert.match(consumer, /activePolicy\.effectiveDate/);
  assert.match(consumer, /activePolicy\.expirationDate/);
  assert.doesNotMatch(consumer, /api\/reconciliation\/verify|handleReconcileIssued|Simulate Canonical Issued Dec Page/);
  const provider = readFileSync(new URL('../components/ProviderPortal.tsx', import.meta.url), 'utf8');
  assert.match(provider, /selectedOffer\?\.coverages \|\| \[\]/);
  assert.doesNotMatch(provider, /workspaceData\?\.offers\?\.\[0\]\?\.coverages/);
  assert.match(consumer, /selection-binding/);
  assert.match(consumer, /setHandoffResult\(bindingData\.handoff\)/);
});

test('consumer acceptance status labels reflect authoritative lifecycle state', () => {
  const consumer = readFileSync(new URL('../components/ConsumerPortal.tsx', import.meta.url), 'utf8');
  assert.match(consumer, /currentCanonicalRound === 'OPEN' && deadlineStatus\?\.isExpired !== true/);
  assert.match(consumer, /effectiveCanonicalRound: 'OPEN' \| 'CONSUMER_REVIEW' = submissionWindowOpen \? 'OPEN' : 'CONSUMER_REVIEW'/);
  assert.match(consumer, /submissionWindowLabel/);
  assert.match(consumer, /submissionWindowOpen \? 'Open for Offers' : 'Policyholder Review'/);
  assert.match(consumer, /submissionWindowOpen \? 'OFFERS OPEN' : 'OFFERS CLOSED'/);
  assert.match(consumer, /\{submissionWindowOpen && \(/);
  assert.match(consumer, /vaultDocs\.length \+ policyVaultItems\.length/);
  assert.match(consumer, /Vault Records/);
});

test('landing opt-in reuses the canonical account form and role-routing boundaries', () => {
  const landing = readFileSync(new URL('../components/LandingPage.tsx', import.meta.url), 'utf8');
  const authModal = readFileSync(new URL('../components/AuthModal.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(landing, /<AuthModal/);
  assert.match(landing, /variant="inline"/);
  assert.match(landing, /onSuccess=\{onAuthSuccess\}/);
  assert.match(app, /onAuthSuccess=\{handleAuthSuccess\}/);
  assert.doesNotMatch(landing, /<form/);
  assert.match(authModal, /variant\?: 'modal' \| 'inline'/);
  assert.match(authModal, /Create Account/);
  assert.match(authModal, /Sign In/);
  assert.match(authModal, /Fast Demo/);
  assert.match(authModal, /Choose Your Account Type/);
  assert.match(authModal, /<JurisdictionSelectOptions \/>/);
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
