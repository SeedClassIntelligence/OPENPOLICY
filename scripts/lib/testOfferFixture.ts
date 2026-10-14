import type { PolicyChallengeDatabase } from '../../src/server/db';
import type { Offer } from '../../src/types/insurance';

/** Test-only fixture. Never imported by production server or client code. */
export function addTestOffer(db: PolicyChallengeDatabase, challengeId: string, suffix = '1'): Offer {
  const challenge = db.getChallenge(challengeId);
  if (!challenge) throw new Error(`Test challenge not found: ${challengeId}`);
  const offer: Offer = {
    id: `TEST-OFFER-${challengeId}-${suffix}`,
    challengeId,
    providerId: 'org_apex',
    providerName: 'Test Provider Organization',
    providerLicense: 'TEST-LICENSE',
    carrier: 'Test Insurance Carrier',
    quoteNumber: `TEST-QUOTE-${suffix}`,
    annualPremium: 2540,
    monthlyPremium: 212,
    termMonths: 12,
    effectiveDate: challenge.baseline.effectiveDate,
    expirationDate: challenge.baseline.expirationDate,
    supportingQuoteDocName: 'test-quote.pdf',
    submittedAt: new Date().toISOString(),
    discrepanciesDetected: false,
    status: 'VALIDATED',
    round: 'ROUND_1_OPEN',
    version: 1,
    coverages: structuredClone(challenge.baseline.coverages),
  };
  return db.submitOffer(offer);
}
