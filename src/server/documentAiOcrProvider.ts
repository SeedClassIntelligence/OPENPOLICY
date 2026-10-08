import crypto from 'crypto';
import { GoogleAuth } from 'google-auth-library';

export interface OcrRegion {
  textStart: number;
  textEnd: number;
  confidence?: number;
  normalizedVertices: Array<{ x: number; y: number }>;
}

export interface ProviderNeutralOcrPage {
  pageNumber: number;
  text: string;
  regions: OcrRegion[];
}

export interface ProviderNeutralOcrDocument {
  runId: string;
  sourceSha256: string;
  sourceGeneration: string;
  extractor: 'GOOGLE_DOCUMENT_AI';
  extractorVersion: string;
  processedAt: string;
  pages: ProviderNeutralOcrPage[];
}

export class DocumentAiPageLimitError extends Error {
  constructor(readonly pages: number, readonly pageLimit: number) {
    super(`Document has ${pages} pages and exceeds the ${pageLimit}-page request limit.`);
  }
}

export interface DocumentAiTransport {
  process(input: { contentBase64: string; pages?: number[] }): Promise<any>;
}

function pageLimitDetails(error: any): { pages: number; pageLimit: number } | undefined {
  const apiError = error?.response?.data?.error;
  if (apiError?.status !== 'INVALID_ARGUMENT') return undefined;
  const detail = (apiError.details || []).find((value: any) => value?.reason === 'PAGE_LIMIT_EXCEEDED');
  const pages = Number(detail?.metadata?.pages);
  const pageLimit = Number(detail?.metadata?.page_limit);
  return Number.isInteger(pages) && pages > 0 && Number.isInteger(pageLimit) && pageLimit > 0
    ? { pages, pageLimit }
    : undefined;
}

export class GoogleDocumentAiTransport implements DocumentAiTransport {
  private readonly auth: GoogleAuth;
  private readonly endpoint: string;

  constructor(options: { projectNumber?: string; location?: string; processorId?: string; auth?: GoogleAuth } = {}) {
    const projectNumber = options.projectNumber || process.env.OPENPOLICY_DOCUMENT_AI_PROJECT_NUMBER?.trim() || '';
    const location = options.location || process.env.OPENPOLICY_DOCUMENT_AI_LOCATION?.trim() || '';
    const processorId = options.processorId || process.env.OPENPOLICY_DOCUMENT_AI_PROCESSOR_ID?.trim() || '';
    if (!/^\d+$/.test(projectNumber) || !/^[a-z0-9-]+$/.test(location) || !/^[a-f0-9]+$/.test(processorId)) {
      throw new Error('Valid Document AI project number, location, and processor ID are required.');
    }
    this.auth = options.auth || new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    this.endpoint = `https://${location}-documentai.googleapis.com/v1/projects/${projectNumber}/locations/${location}/processors/${processorId}:process`;
  }

  async process(input: { contentBase64: string; pages?: number[] }): Promise<any> {
    const client = await this.auth.getClient();
    try {
      const response = await client.request({
        url: this.endpoint,
        method: 'POST',
        data: {
          rawDocument: { mimeType: 'application/pdf', content: input.contentBase64 },
          processOptions: {
            ...(input.pages ? { individualPageSelector: { pages: input.pages } } : {}),
            ocrConfig: { enableNativePdfParsing: true }
          }
        }
      });
      return response.data;
    } catch (error) {
      const details = pageLimitDetails(error);
      if (details) throw new DocumentAiPageLimitError(details.pages, details.pageLimit);
      throw error;
    }
  }
}

function anchoredText(fullText: string, anchor: any): { text: string; start: number; end: number } {
  const segments = Array.isArray(anchor?.textSegments) ? anchor.textSegments : [];
  let text = '';
  let first = Number.POSITIVE_INFINITY;
  let last = 0;
  for (const segment of segments) {
    const start = Number(segment.startIndex || 0);
    const end = Number(segment.endIndex || 0);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > fullText.length) {
      throw new Error('Document AI returned an invalid text anchor.');
    }
    text += fullText.slice(start, end);
    first = Math.min(first, start);
    last = Math.max(last, end);
  }
  return { text, start: Number.isFinite(first) ? first : 0, end: last };
}

function convertPage(fullText: string, rawPage: any, pageNumber: number): ProviderNeutralOcrPage {
  const pageAnchor = anchoredText(fullText, rawPage?.layout?.textAnchor);
  const regions: OcrRegion[] = [];
  for (const block of Array.isArray(rawPage?.blocks) ? rawPage.blocks : []) {
    const anchor = anchoredText(fullText, block?.layout?.textAnchor);
    regions.push({
      textStart: anchor.start,
      textEnd: anchor.end,
      confidence: Number.isFinite(Number(block?.layout?.confidence)) ? Number(block.layout.confidence) : undefined,
      normalizedVertices: (block?.layout?.boundingPoly?.normalizedVertices || []).map((vertex: any) => ({
        x: Number(vertex.x || 0), y: Number(vertex.y || 0)
      }))
    });
  }
  return { pageNumber, text: pageAnchor.text, regions };
}

export class DocumentAiOcrProvider {
  readonly extractor = 'GOOGLE_DOCUMENT_AI' as const;
  constructor(
    private readonly transport: DocumentAiTransport = new GoogleDocumentAiTransport(),
    private readonly extractorVersion = 'enterprise-ocr-default',
    private readonly maximumPages = 500
  ) {}

  async extract(input: { bytes: Buffer; sourceSha256: string; sourceGeneration: string }): Promise<ProviderNeutralOcrDocument> {
    const actualHash = crypto.createHash('sha256').update(input.bytes).digest('hex');
    if (actualHash !== input.sourceSha256) throw new Error('OCR source bytes do not match the committed SHA-256.');
    const contentBase64 = input.bytes.toString('base64');
    const pages: ProviderNeutralOcrPage[] = [];
    try {
      const response = await this.transport.process({ contentBase64 });
      const document = response?.document;
      const fullText = String(document?.text || '');
      for (const [index, page] of (document?.pages || []).entries()) pages.push(convertPage(fullText, page, index + 1));
    } catch (error) {
      if (!(error instanceof DocumentAiPageLimitError)) throw error;
      if (error.pages > this.maximumPages) throw new Error(`Document exceeds the ${this.maximumPages}-page OCR limit.`);
      const chunkSize = Math.min(error.pageLimit, 15);
      for (let start = 1; start <= error.pages; start += chunkSize) {
        const selected = Array.from({ length: Math.min(chunkSize, error.pages - start + 1) }, (_, index) => start + index);
        const response = await this.transport.process({ contentBase64, pages: selected });
        const document = response?.document;
        const fullText = String(document?.text || '');
        const returned = Array.isArray(document?.pages) ? document.pages : [];
        if (returned.length !== selected.length) throw new Error('Document AI returned an incomplete page selection.');
        returned.forEach((page: any, index: number) => pages.push(convertPage(fullText, page, selected[index])));
      }
    }
    if (!pages.length) throw new Error('Document AI returned no OCR pages.');
    return {
      runId: `OCR-${crypto.randomUUID()}`,
      sourceSha256: input.sourceSha256,
      sourceGeneration: input.sourceGeneration,
      extractor: this.extractor,
      extractorVersion: this.extractorVersion,
      processedAt: new Date().toISOString(),
      pages
    };
  }
}
