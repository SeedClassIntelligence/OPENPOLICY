import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuarantineObjectName,
  extractionRequiresReview,
  normalizeDocumentFileName,
  validateDeclarationsPdf
} from './documentIntelligence';

const minimalPdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n', 'latin1');

test('accepts recognizable PDF bytes and computes evidence hash', () => {
  const result = validateDeclarationsPdf({
    bytes: minimalPdf,
    contentType: 'application/pdf',
    fileName: '../../Policy:Declarations.pdf'
  });
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.sha256.length, 64);
    assert.equal(result.byteLength, minimalPdf.length);
    assert.equal(result.normalizedFileName, 'Policy_Declarations.pdf');
  }
});

test('rejects spoofed, malformed, empty and oversized uploads', () => {
  assert.equal(validateDeclarationsPdf({ bytes: minimalPdf, contentType: 'image/png', fileName: 'x.pdf' }).valid, false);
  assert.equal(validateDeclarationsPdf({ bytes: Buffer.from('not a pdf'), contentType: 'application/pdf', fileName: 'x.pdf' }).valid, false);
  assert.equal(validateDeclarationsPdf({ bytes: Buffer.alloc(0), contentType: 'application/pdf', fileName: 'x.pdf' }).valid, false);
  assert.equal(validateDeclarationsPdf({ bytes: minimalPdf, contentType: 'application/pdf', fileName: 'x.pdf', maxBytes: 4 }).valid, false);
});

test('object names are server controlled and do not disclose Firebase UID', () => {
  const objectName = buildQuarantineObjectName('firebase-user@example.com', 'DOC-1234');
  assert.match(objectName, /^quarantine\/[a-f0-9]{24}\/DOC-1234\/original\.pdf$/);
  assert.equal(objectName.includes('firebase-user'), false);
  assert.throws(() => buildQuarantineObjectName('owner', '../escape'));
});

test('low confidence, invalid confidence or critical issues require review', () => {
  assert.equal(extractionRequiresReview({ criticalIssues: [], fieldConfidences: [0.99, 0.94] }), false);
  assert.equal(extractionRequiresReview({ criticalIssues: [], fieldConfidences: [0.89] }), true);
  assert.equal(extractionRequiresReview({ criticalIssues: ['missing policy number'], fieldConfidences: [0.99] }), true);
  assert.equal(extractionRequiresReview({ criticalIssues: [], fieldConfidences: [] }), true);
});

test('normalizes dangerous filenames without trusting their extension', () => {
  assert.equal(normalizeDocumentFileName('C:\\fakepath\\my policy'), 'my policy.pdf');
  assert.equal(normalizeDocumentFileName('../..'), 'declarations.pdf');
});
