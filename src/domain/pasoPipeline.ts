export const PASO_PIPELINE_STAGES = ['IDENTIFIED','CONTACT_ATTEMPTED','ENGAGED','QUALIFIED','DEMO_SCHEDULED','DEMO_COMPLETED','APPLICATION_STARTED','APPLICATION_SUBMITTED','VERIFICATION_PENDING','VERIFIED','PAYMENT_PENDING','PAID_ACTIVE','ACTIVE_PARTICIPANT','LOST','DISQUALIFIED'] as const;
export type PasoPipelineStage = typeof PASO_PIPELINE_STAGES[number];
export type PasoTransitionSource = 'SALES_ACTIVITY'|'PROVIDER_APPLICATION'|'PROVIDER_AUTHORITY'|'COMMERCIAL_LEDGER'|'MARKETPLACE_EVIDENCE';

const MANUAL_FORWARD:Partial<Record<PasoPipelineStage,PasoPipelineStage>>={
  IDENTIFIED:'CONTACT_ATTEMPTED',CONTACT_ATTEMPTED:'ENGAGED',ENGAGED:'QUALIFIED',QUALIFIED:'DEMO_SCHEDULED',DEMO_SCHEDULED:'DEMO_COMPLETED'
};
const AUTHORITATIVE_STAGES=new Set<PasoPipelineStage>(['APPLICATION_STARTED','APPLICATION_SUBMITTED','VERIFICATION_PENDING','VERIFIED','PAYMENT_PENDING','PAID_ACTIVE','ACTIVE_PARTICIPANT']);

export function assertSalesTransition(from:PasoPipelineStage,to:PasoPipelineStage):void{
  if(AUTHORITATIVE_STAGES.has(to))throw Object.assign(new Error(`${to} must derive from authoritative platform evidence.`),{statusCode:409});
  if(to==='LOST'||to==='DISQUALIFIED')return;
  if(MANUAL_FORWARD[from]!==to)throw Object.assign(new Error(`Invalid sales pipeline transition: ${from} -> ${to}`),{statusCode:409});
}

export function authoritativePipelineStage(input:{currentStage:PasoPipelineStage;applicationStatus?:string;providerOrganizationId?:string;paidMembership:boolean;activeMarketplaceParticipation:boolean}):{stage:PasoPipelineStage;source:PasoTransitionSource;referenceKind:string}|undefined{
  if(input.activeMarketplaceParticipation&&input.providerOrganizationId)return {stage:'ACTIVE_PARTICIPANT',source:'MARKETPLACE_EVIDENCE',referenceKind:'MARKETPLACE_PARTICIPATION'};
  if(input.paidMembership&&input.providerOrganizationId)return {stage:'PAID_ACTIVE',source:'COMMERCIAL_LEDGER',referenceKind:'PAID_SUBSCRIPTION'};
  if(input.applicationStatus==='APPROVED'&&input.providerOrganizationId){
    if(input.currentStage==='VERIFIED')return {stage:'PAYMENT_PENDING',source:'COMMERCIAL_LEDGER',referenceKind:'UNPAID_MEMBERSHIP'};
    if(input.currentStage==='PAYMENT_PENDING')return undefined;
    return {stage:'VERIFIED',source:'PROVIDER_AUTHORITY',referenceKind:'APPROVED_PROVIDER_APPLICATION'};
  }
  if(input.applicationStatus==='UNDER_REVIEW')return {stage:'VERIFICATION_PENDING',source:'PROVIDER_APPLICATION',referenceKind:'PROVIDER_APPLICATION'};
  if(input.applicationStatus==='SUBMITTED')return {stage:'APPLICATION_SUBMITTED',source:'PROVIDER_APPLICATION',referenceKind:'PROVIDER_APPLICATION'};
  return undefined;
}
