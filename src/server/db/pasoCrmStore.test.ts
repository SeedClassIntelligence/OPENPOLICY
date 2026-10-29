import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PostgresStore } from './postgresStore.ts';
import { PasoStore } from './pasoStore.ts';
import { normalizeOrganizationName, normalizeWebsiteDomain, PasoCrmStore } from './pasoCrmStore.ts';

test('prospect identity normalization is deterministic',()=>{
  assert.equal(normalizeOrganizationName('All Nevada Insurance, Inc.'),'ALL NEVADA INSURANCE');
  assert.equal(normalizeOrganizationName('ALL NEVADA INSURANCE CORPORATION'),'ALL NEVADA INSURANCE');
  assert.equal(normalizeWebsiteDomain('https://www.Example.com/path'),'example.com');
  assert.equal(normalizeWebsiteDomain('not a domain'),undefined);
});

test('PASO-2 preserves duplicates for review, validates contacts, scopes reps, and audits reassignment',async()=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'openpolici-paso-crm-'));const database=new PostgresStore(dataDir), foundation=new PasoStore(database),crm=new PasoCrmStore(database);
  try{
    const teamA=await foundation.createTeam({name:'Team A',actorId:'owner'}),teamB=await foundation.createTeam({name:'Team B',actorId:'owner'});
    const repA=await foundation.createProfile({internalUserId:'rep-a',teamId:teamA.id,role:'SALES_REP',employmentClassification:'EMPLOYEE',effectiveFrom:'2026-10-28',actorId:'owner'});
    const repB=await foundation.createProfile({internalUserId:'rep-b',teamId:teamB.id,role:'SALES_REP',employmentClassification:'EMPLOYEE',effectiveFrom:'2026-10-28',actorId:'owner'});
    const first=await crm.createProspect({organizationName:'All Nevada Insurance Inc.',organizationType:'AGENCY',businessAddress:'100 Main St, Las Vegas, NV',jurisdiction:'NV',website:'https://allnevada.example',knownLicenseIdentifiers:['NV-47854'],primaryInsuranceLines:['personal_auto'],prospectSource:'MANUAL',assignedRepId:repA.id,actorId:'owner'});
    assert.equal(first.duplicates.length,0);assert.equal(first.prospect.qualificationStatus,'UNQUALIFIED');
    const second=await crm.createProspect({organizationName:'All Nevada Insurance Corporation',organizationType:'AGENCY',businessAddress:'200 Other St, Las Vegas, NV',jurisdiction:'NV',website:'https://www.allnevada.example/team',knownLicenseIdentifiers:[],primaryInsuranceLines:['homeowners'],prospectSource:'CSV_IMPORT',assignedRepId:repB.id,actorId:'owner'});
    assert.equal(second.prospect.qualificationStatus,'DUPLICATE_REVIEW');assert.deepEqual(second.duplicates[0].matchReasons.sort(),['ORGANIZATION_NAME','WEBSITE_DOMAIN']);
    assert.deepEqual((await crm.listProspects({role:'SALES_REP',profileId:repA.id,teamId:teamA.id})).map(x=>x.id),[first.prospect.id]);
    assert.equal((await crm.listProspects({role:'SALES_MANAGER',profileId:'mgr-a',teamId:teamA.id})).length,1);
    await assert.rejects(()=>crm.createContact({prospectId:first.prospect.id,contactName:'Jane Agent',businessRole:'Principal',businessEmail:'invalid',communicationPreferences:['EMAIL'],consentOrLawfulOutreachBasis:'Public business inquiry address',actorId:'rep-a'}),/invalid/);
    const contact=await crm.createContact({prospectId:first.prospect.id,contactName:'Jane Agent',businessRole:'Principal',businessEmail:'JANE@AGENCY.EXAMPLE',communicationPreferences:['email'],consentOrLawfulOutreachBasis:'Public business inquiry address',actorId:'rep-a'});
    assert.equal(contact.businessEmail,'jane@agency.example');
    const outreach=await crm.recordOutreach({prospectId:first.prospect.id,actorProfileId:repA.id,activityType:'email',occurredAt:'2026-10-28T12:00:00.000Z',nextActionAt:'2026-10-30T12:00:00.000Z',outcome:'Awaiting response',actorId:'rep-a'});
    assert.equal(outreach.activityType,'EMAIL');assert.equal((await crm.listOutreach(first.prospect.id)).length,1);
    const organizationEvidence=await crm.recordAuthorityEvidence({prospectId:first.prospect.id,subjectType:'ORGANIZATION_LICENSE',legalName:'All Nevada Insurance Inc.',jurisdiction:'NV',authorityNumber:'NV-ORG-47854',npn:'8645063',status:'ACTIVE',expirationDate:'2027-12-31',qualifications:['PROPERTY','CASUALTY'],sourceName:'Nevada Division of Insurance',sourceUrl:'https://di.nv.gov/nv/r/doi/reports-and-lookups/home',sourceRecordId:'NV-ORG-47854',retrievedAt:'2026-10-29',actorId:'rep-a'});
    const individualEvidence=await crm.recordAuthorityEvidence({prospectId:first.prospect.id,subjectType:'INDIVIDUAL_LICENSE',legalName:'Jane Agent',jurisdiction:'NV',authorityNumber:'NV-IND-51989',npn:'1808605',status:'ACTIVE',expirationDate:'2027-12-31',qualifications:['PROPERTY','CASUALTY'],sourceName:'Nevada Division of Insurance',sourceUrl:'https://di.nv.gov/nv/r/doi/reports-and-lookups/home',sourceRecordId:'NV-IND-51989',retrievedAt:'2026-10-29',actorId:'rep-a'});
    assert.equal(organizationEvidence.reviewStatus,'PENDING_OWNER_REVIEW');
    assert.equal(individualEvidence.reviewStatus,'PENDING_OWNER_REVIEW');
    assert.equal((await crm.listAuthorityEvidence(first.prospect.id)).length,2);
    assert.match(organizationEvidence.evidenceSha256,/^[a-f0-9]{64}$/);
    await assert.rejects(()=>crm.recordAuthorityEvidence({prospectId:first.prospect.id,subjectType:'ORGANIZATION_LICENSE',legalName:'All Nevada Insurance Inc.',jurisdiction:'NV',authorityNumber:'NV-ORG-47854',npn:'8645063',status:'ACTIVE',expirationDate:'2027-12-31',qualifications:['PROPERTY','CASUALTY'],sourceName:'Nevada Division of Insurance',sourceUrl:'https://di.nv.gov/nv/r/doi/reports-and-lookups/home',sourceRecordId:'NV-ORG-47854',retrievedAt:'2026-10-29',actorId:'rep-a'}),/already recorded/);
    assert.equal((await crm.listDuplicateCandidates()).length,1);
    await crm.resolveDuplicate({candidateId:second.duplicates[0].id,resolution:'DISTINCT',reason:'Separate legal entity confirmed by registry evidence',actorId:'manager-a'});
    assert.equal((await crm.listDuplicateCandidates()).length,0);assert.equal((await crm.getProspect(second.prospect.id))?.qualificationStatus,'UNQUALIFIED');
    await crm.reassign({prospectId:first.prospect.id,repId:repB.id,reason:'Owner-approved territory transfer',actorId:'owner'});
    const sql=await database.getPgClient();const history=await sql.query<{count:number}>('SELECT count(*)::int AS count FROM prospect_assignment_history WHERE prospect_id=$1',[first.prospect.id]);assert.equal(Number(history.rows[0].count),2);
    const migration=await sql.query<{count:number}>("SELECT count(*)::int AS count FROM _migrations WHERE name='0031_paso_acquisition_crm'");assert.equal(Number(migration.rows[0].count),1);
    const evidenceMigration=await sql.query<{count:number}>("SELECT count(*)::int AS count FROM _migrations WHERE name='0036_paso_prospect_authority_evidence'");assert.equal(Number(evidenceMigration.rows[0].count),1);
  }finally{await database.close();fs.rmSync(dataDir,{recursive:true,force:true});}
});
