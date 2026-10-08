import crypto from 'crypto';

export const MAX_DECLARATIONS_BYTES = 10 * 1024 * 1024;

export type DocumentValidationResult =
  | { valid: true; sha256: string; byteLength: number; normalizedFileName: string }
  | { valid: false; code: 'EMPTY' | 'TOO_LARGE' | 'UNSUPPORTED_TYPE' | 'INVALID_PDF'; message: string };

export function normalizeDocumentFileName(input: string): string {
  const leaf = input.replace(/\\/g, '/').split('/').pop() || 'declarations.pdf';
  const safe = leaf.normalize('NFKC').replace(/[^a-zA-Z0-9._ -]/g, '_').trim();
  const withName = safe && safe !== '.' && safe !== '..' ? safe : 'declarations.pdf';
  return withName.toLowerCase().endsWith('.pdf') ? withName.slice(0, 180) : `${withName.slice(0, 176)}.pdf`;
}

export function validateDeclarationsPdf(params: {
  bytes: Buffer;
  contentType: string | undefined;
  fileName: string | undefined;
  maxBytes?: number;
}): DocumentValidationResult {
  const maxBytes = params.maxBytes ?? MAX_DECLARATIONS_BYTES;
  if (!params.bytes.length) {
    return { valid: false, code: 'EMPTY', message: 'The uploaded document is empty.' };
  }
  if (params.bytes.length > maxBytes) {
    return { valid: false, code: 'TOO_LARGE', message: `The uploaded document exceeds ${maxBytes} bytes.` };
  }
  if (params.contentType?.split(';', 1)[0].trim().toLowerCase() !== 'application/pdf') {
    return { valid: false, code: 'UNSUPPORTED_TYPE', message: 'Only PDF declarations documents are supported.' };
  }

  // MIME and extension are caller-controlled. Require the PDF header near byte zero and
  // an EOF marker in the bounded tail before the object can leave quarantine.
  const head = params.bytes.subarray(0, Math.min(params.bytes.length, 1024)).toString('latin1');
  const tail = params.bytes.subarray(Math.max(0, params.bytes.length - 4096)).toString('latin1');
  if (!/^\s*%PDF-[12]\.[0-9]/.test(head) || !tail.includes('%%EOF')) {
    return { valid: false, code: 'INVALID_PDF', message: 'The bytes are not a structurally recognizable PDF.' };
  }

  return {
    valid: true,
    sha256: crypto.createHash('sha256').update(params.bytes).digest('hex'),
    byteLength: params.bytes.length,
    normalizedFileName: normalizeDocumentFileName(params.fileName || 'declarations.pdf')
  };
}

export function buildQuarantineObjectName(ownerId: string, documentId: string): string {
  const ownerPartition = crypto.createHash('sha256').update(ownerId).digest('hex').slice(0, 24);
  if (!/^DOC-[A-Za-z0-9-]+$/.test(documentId)) {
    throw new Error('Invalid server document identifier');
  }
  return `quarantine/${ownerPartition}/${documentId}/original.pdf`;
}

export function extractionRequiresReview(params: {
  criticalIssues: string[];
  fieldConfidences: number[];
  minimumConfidence?: number;
}): boolean {
  const minimum = params.minimumConfidence ?? 0.9;
  return params.criticalIssues.length > 0 ||
    params.fieldConfidences.length === 0 ||
    params.fieldConfidences.some(value => !Number.isFinite(value) || value < minimum || value > 1);
}
