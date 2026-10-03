/**
 * PR-0A — Legacy jurisdiction seed
 *
 * 1. Reference data: the 51 jurisdictions (codes and names only).
 * 2. The legacy JURISDICTIONAL_STATUTORY_REGISTRY (NV, OH, CA) migrated as data, exactly as
 *    recorded in code, into IN_REVIEW rulesets whose rules are all UNVERIFIED. These values
 *    were never verified against primary law; they are review candidates, not law. They are
 *    evaluated only in SHADOW mode, and publication requires legal verification (PR-0B).
 *    The legacy registry in qualificationEngine.ts stays untouched until PR-0C (D4).
 * 3. SANDBOX fixture activations for NV, OH and CA, created only when the deployment's
 *    market environment is SANDBOX. They can never authorize a PRODUCTION transaction (D5).
 *
 * Idempotent: an existing ruleset or activation history for a market is never altered.
 */
import { JURISDICTIONAL_STATUTORY_REGISTRY } from '../../../domain/qualificationEngine';
import { JurisdictionRule, MarketEnvironment } from '../../../types/jurisdiction';
import { US_JURISDICTIONS } from '../../../domain/jurisdiction/usJurisdictions';
import { JurisdictionStore } from '../jurisdictionStore';

export const LEGACY_MIGRATION_ACTOR = 'legacy_registry_migration';
export const SANDBOX_FIXTURE_ACTOR = 'sandbox_fixture_seed';

const COVERAGE_RULE_LABEL: Record<string, string> = {
  BODILY_INJURY: 'BI',
  PROPERTY_DAMAGE: 'PD'
};

export async function seedLegacyJurisdictionData(store: JurisdictionStore, environment: MarketEnvironment): Promise<void> {
  await store.ensureReferenceData();

  for (const legacy of Object.values(JURISDICTIONAL_STATUTORY_REGISTRY)) {
    const code = legacy.jurisdiction;
    const name = US_JURISDICTIONS.find(j => j.code === code)?.name || code;

    const existing = await store.getRuleSets(code, 'PERSONAL_AUTO');
    if (existing.length === 0) {
      const authorityId = `AUTH-LEGACY-${code}-LEGISLATURE`;
      const sourceId = `SRC-LEGACY-${code}-${legacy.ruleVersion}`;
      await store.saveAuthority({ id: authorityId, jurisdictionCode: code, name: `${name} Legislature`, kind: 'LEGISLATURE' });
      await store.saveSource({
        id: sourceId,
        jurisdictionCode: code,
        authorityId,
        sourceType: 'STATUTE',
        citation: legacy.citation,
        title: `Legacy registry entry ${legacy.ruleVersion}`,
        notes: 'Migrated verbatim from the legacy JURISDICTIONAL_STATUTORY_REGISTRY. Not retrieved from or verified against the official source.'
      });

      const ruleSet = await store.createRuleSet({
        id: `JRS-LEGACY-${code}-PERSONAL_AUTO-v1`,
        jurisdictionCode: code,
        insuranceLine: 'PERSONAL_AUTO',
        authoredBy: LEGACY_MIGRATION_ACTOR
      });

      const common = {
        ruleSetId: ruleSet.id,
        ruleCategory: 'MINIMUM_LIABILITY' as const,
        enforcementPoint: 'OFFER_QUALIFICATION' as const,
        temporalBasis: 'policyEffectiveDate' as const,
        sourceIds: [sourceId],
        effectiveFrom: legacy.effectiveDate,
        verificationStatus: 'UNVERIFIED' as const
      };
      const rules: JurisdictionRule[] = [];
      for (const coverageCode of legacy.mandatoryCoverageCodes) {
        const label = COVERAGE_RULE_LABEL[coverageCode] || coverageCode;
        rules.push({
          ...common,
          id: `JR-LEGACY-${code}-${label}-REQUIRED`,
          ruleCode: `AUTO.LIABILITY.${label}.REQUIRED`,
          requirementText: `${coverageCode} coverage is mandatory (legacy registry ${legacy.ruleVersion}; unverified).`,
          machineRule: { kind: 'REQUIRED_COVERAGE', coverageCode }
        });
      }
      const mins = legacy.statutoryMinimums;
      if (mins && (mins.bodilyInjuryPerPerson !== undefined || mins.bodilyInjuryPerAccident !== undefined)) {
        rules.push({
          ...common,
          id: `JR-LEGACY-${code}-BI-MINIMUM`,
          ruleCode: 'AUTO.LIABILITY.BI.MINIMUM',
          requirementText: `Bodily injury limits of at least ${mins.bodilyInjuryPerPerson}/${mins.bodilyInjuryPerAccident} (legacy registry ${legacy.ruleVersion}; unverified).`,
          machineRule: { kind: 'MINIMUM_LIMITS', coverageCode: 'BODILY_INJURY', perPerson: mins.bodilyInjuryPerPerson, perAccident: mins.bodilyInjuryPerAccident }
        });
      }
      if (mins && mins.propertyDamage !== undefined) {
        rules.push({
          ...common,
          id: `JR-LEGACY-${code}-PD-MINIMUM`,
          ruleCode: 'AUTO.LIABILITY.PD.MINIMUM',
          requirementText: `Property damage limit of at least ${mins.propertyDamage} (legacy registry ${legacy.ruleVersion}; unverified).`,
          machineRule: { kind: 'MINIMUM_LIMITS', coverageCode: 'PROPERTY_DAMAGE', property: mins.propertyDamage }
        });
      }
      for (const rule of rules) await store.addRule(rule);
      await store.submitForReview(ruleSet.id, LEGACY_MIGRATION_ACTOR);
    }

    if (environment === 'SANDBOX') {
      const key = { jurisdictionCode: code, insuranceLine: 'PERSONAL_AUTO' as const, environment: 'SANDBOX' as const };
      const events = await store.getActivationEvents(key);
      if (events.length === 0) {
        await store.transitionMarket({
          key,
          to: 'ACTIVE',
          actorId: SANDBOX_FIXTURE_ACTOR,
          reason: 'SANDBOX fixture activation for development and validation. Never authorizes a PRODUCTION transaction.'
        });
      }
    }
  }
}
