import type { InsuranceLine } from '../types/jurisdiction';
import type { PolicyNormalizationResult } from '../types/insurance';
import type { ProviderNeutralOcrDocument } from '../server/documentAiOcrProvider';
import { normalizePolicyFields } from './policyFieldNormalization';
import { normalizePropertyPolicyFields } from './propertyPolicyFieldNormalization';
import { normalizeCommercialPolicyFields } from './commercialPolicyFieldNormalization';
import { normalizeCommercialAutoPolicyFields } from './commercialAutoPolicyFieldNormalization';

export function normalizePolicyDocumentByLine(input: {
  documentId: string;
  insuranceLine: InsuranceLine;
  ocr: ProviderNeutralOcrDocument;
  now?: string;
}): PolicyNormalizationResult {
  if (input.insuranceLine === 'PERSONAL_AUTO') return normalizePolicyFields(input);
  if (input.insuranceLine === 'HOMEOWNERS' || input.insuranceLine === 'RENTERS') {
    return normalizePropertyPolicyFields({...input,insuranceLine:input.insuranceLine});
  }
  if (input.insuranceLine === 'COMMERCIAL_AUTO') {
    return normalizeCommercialAutoPolicyFields({ ...input, insuranceLine:'COMMERCIAL_AUTO' });
  }
  if (input.insuranceLine === 'COMMERCIAL_GENERAL_LIABILITY' || input.insuranceLine === 'BUSINESS_OWNERS_POLICY') {
    return normalizeCommercialPolicyFields({ ...input, insuranceLine: input.insuranceLine });
  }
  return {
    extractionRunId:input.ocr.runId,documentId:input.documentId,documentGeneration:input.ocr.sourceGeneration,
    sourceSha256:input.ocr.sourceSha256,normalizer:`OPENPOLICY_${input.insuranceLine}_FIELDS`,normalizerVersion:'0.0.0',fields:[],
    criticalIssues:[`Line-specific normalization is not implemented for ${input.insuranceLine}.`],
    status:'REVIEW_REQUIRED',normalizedAt:input.now||new Date().toISOString()
  };
}

