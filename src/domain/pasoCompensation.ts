export type CompensationEventType='ACQUISITION_COMMISSION'|'RETENTION_BONUS';
export interface CompensationPlanRules{commissionRules:Record<string,number|null>;retentionRules:{paidPeriodsRequired:number}&Record<string,number|null>}
export interface CompensationDecision{eligible:boolean;status:'ACCRUED'|'PENDING_EVIDENCE';amountCents:number;reason:string}

export function calculateCompensation(input:{eventType:CompensationEventType;planCode:string;verifiedOrganization:boolean;approvedAttribution:boolean;paidSubscriptionPeriods:number;plan:CompensationPlanRules}):CompensationDecision{
  if(!input.verifiedOrganization)return {eligible:false,status:'PENDING_EVIDENCE',amountCents:0,reason:'Provider organization is not authoritatively verified.'};
  if(!input.approvedAttribution)return {eligible:false,status:'PENDING_EVIDENCE',amountCents:0,reason:'Approved acquisition attribution is required.'};
  const required=input.eventType==='RETENTION_BONUS'?Number(input.plan.retentionRules.paidPeriodsRequired||3):1;
  if(input.paidSubscriptionPeriods<required)return {eligible:false,status:'PENDING_EVIDENCE',amountCents:0,reason:`${required} successful paid membership period(s) required.`};
  const amount=input.eventType==='ACQUISITION_COMMISSION'?input.plan.commissionRules[input.planCode]:input.plan.retentionRules[input.planCode];
  if(amount===null||amount===undefined)return {eligible:false,status:'PENDING_EVIDENCE',amountCents:0,reason:'An approved contract-specific enterprise compensation schedule is required.'};
  if(!Number.isInteger(amount)||amount<0)throw new Error('Compensation plan amount is invalid.');
  return {eligible:true,status:'ACCRUED',amountCents:amount,reason:'All approved compensation evidence is present.'};
}

export function allocateCompensation(totalCents:number,primaryRepId:string,splits:{repId:string;basisPoints:number}[]):{repId:string;amountCents:number}[]{
  const unique=new Set<string>([primaryRepId]);let splitBps=0;for(const split of splits){if(unique.has(split.repId)||!Number.isInteger(split.basisPoints)||split.basisPoints<=0)throw new Error('Compensation split allocations must use unique representatives and positive integer basis points.');unique.add(split.repId);splitBps+=split.basisPoints;}if(splitBps>10_000)throw new Error('Compensation split allocations cannot exceed 100%.');
  const allocated=splits.map(split=>({repId:split.repId,amountCents:Math.floor(totalCents*split.basisPoints/10_000)}));const assigned=allocated.reduce((sum,x)=>sum+x.amountCents,0);return [{repId:primaryRepId,amountCents:totalCents-assigned},...allocated];
}
