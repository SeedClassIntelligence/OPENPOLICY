import test from 'node:test';
import assert from 'node:assert/strict';
import { POLICY_LINE_PROFILES } from './policyLineProfiles';

test('property and commercial development lines have distinct versioned contracts', () => {
  const profiles = Object.values(POLICY_LINE_PROFILES);
  assert.equal(profiles.length, 4);
  assert.equal(new Set(profiles.map(profile => profile.insuranceLine)).size, profiles.length);
  assert.equal(profiles.every(profile => profile.profileVersion === 1 && profile.distinctContract), true);
});

test('BOP is not treated as renamed homeowners coverage', () => {
  const homeowners = POLICY_LINE_PROFILES.HOMEOWNERS;
  const bop = POLICY_LINE_PROFILES.BUSINESS_OWNERS_POLICY;
  assert.equal(homeowners.riskSubjects.includes('RESIDENCE'), true);
  assert.equal(bop.riskSubjects.includes('BUSINESS_ENTITY'), true);
  assert.equal(bop.riskSubjects.includes('COMMERCIAL_PROPERTY'), true);
  assert.equal(bop.coverageDimensions.includes('BUSINESS_INCOME'), true);
  assert.notDeepEqual(homeowners.riskSubjects, bop.riskSubjects);
});

test('CGL and BOP may share extraction infrastructure without sharing a contract', () => {
  const cgl = POLICY_LINE_PROFILES.COMMERCIAL_GENERAL_LIABILITY;
  const bop = POLICY_LINE_PROFILES.BUSINESS_OWNERS_POLICY;
  assert.equal(cgl.sharesExtractionFamilyWith.includes('BUSINESS_OWNERS_POLICY'), true);
  assert.equal(bop.sharesExtractionFamilyWith.includes('COMMERCIAL_GENERAL_LIABILITY'), true);
  assert.equal((cgl.coverageDimensions as readonly string[]).includes('PROPERTY'), false);
  assert.equal((bop.coverageDimensions as readonly string[]).includes('PROPERTY'), true);
});

