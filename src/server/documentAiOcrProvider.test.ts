import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  DocumentAiOcrProvider, DocumentAiPageLimitError, type DocumentAiTransport
} from './documentAiOcrProvider';

const bytes = Buffer.from('%PDF-1.4\nreal evidence\n%%EOF');
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
function responseFor(pages: number[]) {
  const texts = pages.map(page => `Page ${page} declarations coverage limits. `);
  const text = texts.join('');
  let offset = 0;
  return {
    document: {
      text,
      pages: texts.map(value => {
        const start = offset; offset += value.length;
        return {
          layout: { textAnchor: { textSegments: [{ startIndex: start, endIndex: offset }] } },
          blocks: [{ layout: {
            confidence: 0.97,
            textAnchor: { textSegments: [{ startIndex: start, endIndex: offset }] },
            boundingPoly: { normalizedVertices: [{ x: 0.1, y: 0.2 }, { x: 0.9, y: 0.2 }] }
          } }]
        };
      })
    }
  };
}

test('converts a provider response into page and region provenance', async () => {
  const transport: DocumentAiTransport = { async process() { return responseFor([1, 2]); } };
  const result = await new DocumentAiOcrProvider(transport, 'ocr-test').extract({
    bytes, sourceSha256: sha256, sourceGeneration: '9'
  });
  assert.equal(result.pages.length, 2);
  assert.equal(result.pages[1].pageNumber, 2);
  assert.equal(result.pages[0].regions[0].confidence, 0.97);
  assert.deepEqual(result.pages[0].regions[0].normalizedVertices[0], { x: 0.1, y: 0.2 });
});

test('chunks long documents using the service-reported page count and limit', async () => {
  const requests: Array<number[] | undefined> = [];
  const transport: DocumentAiTransport = {
    async process(input) {
      requests.push(input.pages);
      if (!input.pages) throw new DocumentAiPageLimitError(32, 15);
      return responseFor(input.pages);
    }
  };
  const result = await new DocumentAiOcrProvider(transport).extract({ bytes, sourceSha256: sha256, sourceGeneration: '10' });
  assert.equal(result.pages.length, 32);
  assert.deepEqual(requests.map(value => value?.length), [undefined, 15, 15, 2]);
  assert.equal(result.pages[31].pageNumber, 32);
});

test('rejects hash mismatch, excessive pages, incomplete output, and empty OCR', async () => {
  const unused: DocumentAiTransport = { async process() { throw new Error('must not run'); } };
  await assert.rejects(() => new DocumentAiOcrProvider(unused).extract({
    bytes, sourceSha256: 'b'.repeat(64), sourceGeneration: '1'
  }), /SHA-256/);

  const tooLong: DocumentAiTransport = { async process() { throw new DocumentAiPageLimitError(501, 15); } };
  await assert.rejects(() => new DocumentAiOcrProvider(tooLong).extract({
    bytes, sourceSha256: sha256, sourceGeneration: '1'
  }), /500-page/);

  let first = true;
  const incomplete: DocumentAiTransport = { async process(input) {
    if (first) { first = false; throw new DocumentAiPageLimitError(16, 15); }
    return responseFor((input.pages || []).slice(0, -1));
  } };
  await assert.rejects(() => new DocumentAiOcrProvider(incomplete).extract({
    bytes, sourceSha256: sha256, sourceGeneration: '1'
  }), /incomplete/);

  const empty: DocumentAiTransport = { async process() { return { document: { text: '', pages: [] } }; } };
  await assert.rejects(() => new DocumentAiOcrProvider(empty).extract({
    bytes, sourceSha256: sha256, sourceGeneration: '1'
  }), /no OCR pages/);
});
