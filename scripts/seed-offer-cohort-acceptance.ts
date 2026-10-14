import { PostgresStore } from '../src/server/db/postgresStore';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Offer-cohort acceptance fixtures are forbidden in production.');
}

const store = new PostgresStore(process.env.OPENPOLICY_DATA_DIR || './data/openpolicy_pg');
await store.init();
try {
  const database = await store.getPgClient();
  const now = new Date().toISOString();
  const closesAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const competition = await store.getCompetitionForChallenge('CHAL-NV-49281');
  if (!competition) throw new Error('Canonical local fixture competition was not found.');
  await store.saveCompetition({
    ...competition,
    status: 'OPEN',
    currentRound: 'OPEN',
    closesAt,
    offerCohortSize: 10,
    activeOfferCohort: 1,
    maximumActivatedProviders: 30
  });
  for (let index = 1; index <= 12; index += 1) {
    const suffix = String(index).padStart(2, '0');
    const organizationId = `org_acceptance_standby_${suffix}`;
    await database.query(
      `INSERT INTO provider_organizations
       (id,legal_name,display_name,organization_type,verification_status,marketplace_status,states,lines_of_business,created_at)
       VALUES ($1,$2,$2,'AGENCY','VERIFIED','ACTIVE','["NV"]','["PERSONAL_AUTO"]',$3)
       ON CONFLICT (id) DO NOTHING;`,
      [organizationId, `Acceptance Standby Provider ${index}`, now]
    );
    await store.saveInvitation({
      id: `INV-ACCEPTANCE-${suffix}`,
      challengeId: 'CHAL-NV-49281',
      competitionId: competition.id,
      providerOrganizationId: organizationId,
      eligibilityResult: 'ELIGIBLE',
      eligibilityReasons: ['local cohort acceptance fixture'],
      status: 'STANDBY',
      invitedAt: now,
      expiresAt: closesAt,
      standbyPosition: index + 2
    });
  }
  console.log(await store.getOfferCohortStatus('CHAL-NV-49281'));
} finally {
  await store.close();
}
