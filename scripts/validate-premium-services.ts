import './lib/isolatedDataDir';
import http from 'http';
import { app } from '../server';
import { postgresStore } from '../src/server/db/postgresStore';
import { commercialStore } from '../src/server/db/commercialStore';

let passed = 0;
function check(value: unknown, message: string) { if (!value) throw new Error(message); passed++; console.log(`  [PASS] ${message}`); }
async function request(server: http.Server, method: string, path: string, body?: any, headers: Record<string,string> = {}) {
  return new Promise<{status:number;body:any}>((resolve,reject)=>{ const port=(server.address() as any).port;
    const req=http.request({hostname:'127.0.0.1',port,path,method,headers:{'Content-Type':'application/json',...headers}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>{try{resolve({status:res.statusCode||0,body:JSON.parse(data)})}catch{resolve({status:res.statusCode||0,body:data})}})});req.on('error',reject);if(body)req.write(JSON.stringify(body));req.end(); });
}

async function run() {
  const server=http.createServer(app); await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    await postgresStore.init(); await postgresStore.seedCanonicalProviderData(); await commercialStore.seedCanonicalPlans();
    const client=await commercialStore.getClient();
    await request(server,'GET','/api/health');
    await client.query(`UPDATE provider_users SET role='OWNER' WHERE id='user_apex_1'`);
    const enrollment=await commercialStore.enrollCommercialAgreement({providerOrgId:'org_apex',planId:'PLAN_OPEN_POLICY_PREMIUM',planVersionId:'cpv_open_policy_premium_v1',actorRole:'ADMIN'});
    const now=new Date().toISOString();
    for(const type of ['AUTOMATED_APPETITE_MATCHING','ENTERPRISE_REPORTING','API_ACCESS','MULTI_LOCATION_ADMIN']) await client.query(
      `INSERT INTO provider_entitlements(id,provider_organization_id,commercial_agreement_id,entitlement_type,enforcement_policy,scope,effective_from,created_at)
       VALUES($1,'org_apex',$2,$3,'HARD_BLOCK','{}',$4,$4)`,[`ent_http_${type}`,enrollment.agreement.id,type,now]);
    const apex={'x-provider-user-id':'user_apex_1'}, sierra={'x-provider-user-id':'user_sierra_1'};

    check((await request(server,'GET','/api/commercial/premium/report',undefined,sierra)).status===403,'unentitled organization cannot read enterprise report');
    check((await request(server,'GET','/api/commercial/premium/report',undefined,apex)).status===200,'entitled organization reads only its report');
    const rule=await request(server,'POST','/api/commercial/premium/workflow-rules',{name:'NV Auto',jurisdictions:['NV'],insuranceLines:['PERSONAL_AUTO'],riskMarkets:[],action:'PRIORITIZE'},apex);
    check(rule.status===201,`provider owner creates workflow rule (${rule.status}: ${JSON.stringify(rule.body)})`);
    check((await request(server,'GET','/api/commercial/premium/workflow-rules',undefined,sierra)).status===403,'workflow rules fail closed without entitlement');
    const cred=await request(server,'POST','/api/commercial/premium/api-credentials',{label:'Test API',scopes:['opportunities:read']},apex);
    check(cred.status===201 && cred.body.credential.token.startsWith('op_live_'),'credential secret is revealed once');
    const listed=await request(server,'GET','/api/commercial/premium/api-credentials',undefined,apex);
    const token=cred.body.credential.token;
    check(listed.status===200 && JSON.stringify(listed.body).includes(token)===false,'credential listing never returns secret');
    check((await request(server,'GET','/api/integrations/v1/opportunities',undefined,{Authorization:`Bearer ${token}`})).status===200,'scoped API token reads tenant opportunities');
    check((await request(server,'GET','/api/integrations/v1/reports/summary',undefined,{Authorization:`Bearer ${token}`})).status===403,'API token cannot exceed granted scope');
    check((await request(server,'POST',`/api/commercial/premium/api-credentials/${cred.body.credential.id}/revoke`,{},apex)).status===200,'provider owner revokes API credential');
    check((await request(server,'GET','/api/integrations/v1/opportunities',undefined,{Authorization:`Bearer ${token}`})).status===401,'revoked API token is rejected');
    const location=await request(server,'POST','/api/commercial/premium/locations',{name:'Reno Office',jurisdiction:'NV',addressLine1:'100 Market St',city:'Reno',postalCode:'89501'},apex);
    check(location.status===201,'provider owner creates office location');
    check((await request(server,'POST',`/api/commercial/premium/locations/${location.body.location.id}/assign`,{providerUserId:'user_sierra_1'},apex)).status===403,'cross-organization producer assignment is rejected');
    check((await request(server,'GET','/api/commercial/premium/locations',undefined,sierra)).status===403,'unentitled tenant cannot list another service surface');
    console.log(`PREMIUM SERVICE HTTP ACCEPTANCE: ${passed}/${passed} PASS`);
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); await postgresStore.close(); }
}
run().catch(error=>{console.error(error);process.exitCode=1});
