import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PostgresStore } from './postgresStore.ts';
import { PasoStore } from './pasoStore.ts';
import { PasoCrmStore } from './pasoCrmStore.ts';
import { PasoPipelineStore } from './pasoPipelineStore.ts';

test('PASO-3 projects application, authority, paid membership, and participation from authoritative records',async()=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'openpolici-paso-pipeline-'));const database=new PostgresStore(dataDir),foundation=new PasoStore(database),crm=new PasoCrmStore(database),pipeline=new PasoPipelineStore(database);
  try{
    const team=await foundation.createTeam({name:'Nevada Sales',actorId:'owner'});const rep=await foundation.createProfile({internalUserId:'rep-1',teamId:team.id,role:'SALES_REP',employmentClassification:'EMPLOYEE',effectiveFrom:'2026-10-28',actorId:'owner'});
    const prospect=(await crm.createProspect({organizationName:'Pipeline Test Agency',organizationType:'AGENCY',businessAddress:'100 Test Ave, Las Vegas, NV',jurisdiction:'NV',knownLicenseIdentifiers:['NV-100'],primaryInsuranceLines:['PERSONAL_AUTO'],prospectSource:'MANUAL',assignedRepId:rep.id,actorId:'owner'})).prospect;
    let opportunity=await pipeline.createOpportunity({prospectId:prospect.id,ownerRepId:rep.id,targetMembershipTier:'PLAN_SOLO',actorId:'rep-1'});assert.equal(opportunity.expectedMonthlyMembershipRevenueCents,9900);
    opportunity=await pipeline.transitionSales({opportunityId:opportunity.id,to:'CONTACT_ATTEMPTED',reason:'Initial outreach recorded',actorId:'rep-1'});assert.equal(opportunity.pipelineStage,'CONTACT_ATTEMPTED');
    await assert.rejects(()=>pipeline.transitionSales({opportunityId:opportunity.id,to:'VERIFIED',reason:'Rep asserted approval',actorId:'rep-1'}),/authoritative/);
    const sql=await database.getPgClient(),now='2026-10-28T12:00:00.000Z';
    await sql.query(`INSERT INTO provider_applications(id,firebase_uid,applicant_name,applicant_email,legal_name,display_name,organization_type,jurisdiction_code,insurance_lines,requested_plan_code,status,submitted_at,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'SUBMITTED',$11,$11,$11)`,['app-paso-1','firebase-provider-1','Jane Agent','jane@example.test','Pipeline Test Agency','Pipeline Test Agency','INDEPENDENT_AGENCY','NV','["PERSONAL_AUTO"]','PLAN_SOLO',now]);
    await pipeline.linkApplication({opportunityId:opportunity.id,applicationId:'app-paso-1',actorId:'rep-1'});
    opportunity=await pipeline.syncAuthoritative({opportunityId:opportunity.id,actorId:'system-projector'});assert.equal(opportunity.pipelineStage,'APPLICATION_SUBMITTED');
    await sql.query("UPDATE provider_applications SET status='UNDER_REVIEW' WHERE id='app-paso-1'");opportunity=await pipeline.syncAuthoritative({opportunityId:opportunity.id,actorId:'system-projector'});assert.equal(opportunity.pipelineStage,'VERIFICATION_PENDING');
    await sql.query(`INSERT INTO provider_organizations(id,legal_name,display_name,organization_type,verification_status,marketplace_status,states,lines_of_business,created_at,verified_at) VALUES('org-paso-1','Pipeline Test Agency','Pipeline Test Agency','INDEPENDENT_AGENCY','MARKETPLACE_APPROVED','INACTIVE','["NV"]','["PERSONAL_AUTO"]',$1,$1)`,[now]);
    await sql.query("UPDATE provider_applications SET status='APPROVED',provider_organization_id='org-paso-1' WHERE id='app-paso-1'");opportunity=await pipeline.syncAuthoritative({opportunityId:opportunity.id,actorId:'system-projector'});assert.equal(opportunity.pipelineStage,'VERIFIED');opportunity=await pipeline.syncAuthoritative({opportunityId:opportunity.id,actorId:'system-projector'});assert.equal(opportunity.pipelineStage,'PAYMENT_PENDING');
    await sql.query(`INSERT INTO commercial_accounts(id,provider_organization_id,status,currency,created_at,updated_at) VALUES('acct-paso-1','org-paso-1','ACTIVE','USD',$1,$1)`,[now]);
    await sql.query(`INSERT INTO commercial_plans(id,code,display_name,provider_segment,status,created_at) VALUES('plan-paso-1','PLAN_SOLO','Solo','SOLO','ACTIVE',$1)`,[now]);
    await sql.query(`INSERT INTO commercial_plan_versions(id,plan_id,version,effective_from,billing_interval,recurring_fee_cents,currency,terms_snapshot,created_at) VALUES('pv-paso-1','plan-paso-1',1,$1,'MONTHLY',9900,'USD',$2,$1)`,[now,JSON.stringify({priceBookId:'OPEN_POLICY_COMMERCIAL_V2'})]);
    await sql.query(`INSERT INTO commercial_agreements(id,commercial_account_id,provider_organization_id,plan_version_id,status,starts_at,accepted_at,created_at) VALUES('agr-paso-1','acct-paso-1','org-paso-1','pv-paso-1','ACTIVE',$1,$1,$1)`,[now]);
    await sql.query(`INSERT INTO billing_periods(id,provider_organization_id,commercial_agreement_id,commercial_plan_version_id,period_start,period_end,status,closed_at,created_at) VALUES('bp-paso-1','org-paso-1','agr-paso-1','pv-paso-1',$1,'2026-11-28T12:00:00.000Z','CLOSED',$1,$1)`,[now]);
    await sql.query(`INSERT INTO invoices(id,invoice_number,provider_organization_id,commercial_agreement_id,billing_period_id,status,currency,subtotal_cents,total_due_cents,balance_due_cents,issued_at,paid_at,idempotency_key,created_at) VALUES('inv-paso-1','PASO-1','org-paso-1','agr-paso-1','bp-paso-1','PAID','USD',9900,9900,0,$1,$1,'inv-paso-1',$1)`,[now]);
    await sql.query(`INSERT INTO invoice_line_items(id,invoice_id,line_type,description,quantity,unit_price_cents,amount_cents,billing_period_id,created_at) VALUES('ili-paso-1','inv-paso-1','SUBSCRIPTION','Solo membership',1,9900,9900,'bp-paso-1',$1)`,[now]);
    await sql.query(`INSERT INTO payment_records(id,provider_organization_id,invoice_id,amount_cents,currency,payment_method,status,external_reference,settled_at,idempotency_key,created_at) VALUES('pay-paso-1','org-paso-1','inv-paso-1',9900,'USD','STRIPE_TEST','SUCCEEDED','pi_test_paso',$1,'pay-paso-1',$1)`,[now]);
    await sql.query(`INSERT INTO settlement_allocations(id,payment_record_id,invoice_id,amount_allocated_cents,allocated_at) VALUES('sa-paso-1','pay-paso-1','inv-paso-1',9900,$1)`,[now]);
    opportunity=await pipeline.syncAuthoritative({opportunityId:opportunity.id,actorId:'system-projector'});assert.equal(opportunity.pipelineStage,'PAID_ACTIVE');
    await sql.query(`INSERT INTO competitions(id,challenge_id,jurisdiction,line_of_business,status,current_round,participant_count,opened_at,closes_at,rules) VALUES('comp-paso-1','challenge-paso-1','NV','PERSONAL_AUTO','OPEN','SUBMISSION',1,$1,'2026-10-30T12:00:00.000Z','{}')`,[now]);
    await sql.query(`INSERT INTO challenge_participations(id,challenge_id,competition_id,provider_organization_id,accepted_at,status,last_activity_at) VALUES('part-paso-1','challenge-paso-1','comp-paso-1','org-paso-1',$1,'ACTIVE',$1)`,[now]);
    opportunity=await pipeline.syncAuthoritative({opportunityId:opportunity.id,actorId:'system-projector'});assert.equal(opportunity.pipelineStage,'ACTIVE_PARTICIPANT');
    const transitions=await sql.query<any>('SELECT resulting_stage,transition_source FROM sales_pipeline_transitions WHERE sales_opportunity_id=$1 ORDER BY changed_at',[opportunity.id]);assert.ok(transitions.rows.some(x=>x.resulting_stage==='VERIFIED'&&x.transition_source==='PROVIDER_AUTHORITY'));assert.ok(transitions.rows.some(x=>x.resulting_stage==='PAID_ACTIVE'&&x.transition_source==='COMMERCIAL_LEDGER'));assert.ok(transitions.rows.some(x=>x.resulting_stage==='ACTIVE_PARTICIPANT'&&x.transition_source==='MARKETPLACE_EVIDENCE'));
  }finally{await database.close();fs.rmSync(dataDir,{recursive:true,force:true});}
});
