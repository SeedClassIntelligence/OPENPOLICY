import { PostgresStore } from '../src/server/db/postgresStore';
import { JurisdictionStore } from '../src/server/db/jurisdictionStore';
import {
  NEVADA_WAVE0_FOUNDER_ID, NEVADA_WAVE0_RULESET_ID, nevadaWave0Authority,
  nevadaWave0ProviderAuthorityCandidateRules as rules,
  nevadaWave0ProviderAuthoritySources as sources
} from '../src/domain/nevadaWave0ProviderAuthorityCandidatePack';

if(String(process.env.OPENPOLICY_MARKET_ENVIRONMENT||'SANDBOX').toUpperCase()==='PRODUCTION'){
  throw new Error('This acceptance script is local/SANDBOX-only and refuses production publication.');
}
if(!process.env.OPENPOLICY_DATA_DIR)throw new Error('OPENPOLICY_DATA_DIR is required for isolated local acceptance.');

const backingStore=new PostgresStore(process.env.OPENPOLICY_DATA_DIR);
const store=new JurisdictionStore(backingStore);
await store.ensureReferenceData();
await store.saveAuthority(nevadaWave0Authority);
for(const source of sources)await store.saveSource(source);
const draft=await store.createRuleSet({id:NEVADA_WAVE0_RULESET_ID,jurisdictionCode:'NV',insuranceLine:'PERSONAL_AUTO',authoredBy:'CODEX_STAGE_2_AUTHOR',createdAt:'2026-10-20T00:00:00.000Z'});
for(const rule of rules)await store.addRule({...rule,ruleSetId:draft.id});
await store.submitForReview(draft.id,NEVADA_WAVE0_FOUNDER_ID);
const published=await store.publish(draft.id,NEVADA_WAVE0_FOUNDER_ID,'2026-10-20T00:00:00.000Z');
const storedRules=await store.getRules(published.id);
if(published.status!=='PUBLISHED'||storedRules.length!==2||storedRules.some(rule=>rule.verificationStatus!=='VERIFIED'))throw new Error('Local RulePack acceptance failed.');
console.log(JSON.stringify({result:'PASS',environment:'SANDBOX',ruleSetId:published.id,status:published.status,contentSha256:published.contentSha256,rules:storedRules.map(rule=>({id:rule.id,status:rule.verificationStatus,verifiedBy:rule.verifiedBy}))},null,2));
process.exit(0);
