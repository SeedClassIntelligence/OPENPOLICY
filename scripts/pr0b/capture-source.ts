/**
 * PR-0B — Source capture (evidence standard items 2–3)
 *
 * Retrieves an official source verbatim and records exactly what was relied on:
 * the raw bytes (stored under their SHA-256), the URL actually served after redirects,
 * the retrieval time, the HTTP status and content type. Nothing is summarized,
 * normalized or interpreted here; interpretation happens in the dossier, against the
 * captured bytes.
 *
 * Usage (Node's fetch only honours HTTPS_PROXY with NODE_USE_ENV_PROXY=1, Node >= 22.21):
 *   NODE_USE_ENV_PROXY=1 tsx scripts/pr0b/capture-source.ts --jurisdiction NV --tier A \
 *     --citation "NRS 485.185" --url https://www.leg.state.nv.us/NRS/NRS-485.html
 *
 * Output:
 *   research/pr0b/<J>/sources/<sha256>.<ext>        raw captured bytes (immutable)
 *   research/pr0b/<J>/sources/manifest.jsonl        one JSON line per capture (append-only)
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type AuthorityTier = 'A' | 'B' | 'C' | 'D' | 'DISCOVERY';

export interface SourceCapture {
  jurisdictionCode: string;
  tier: AuthorityTier;
  citation: string;
  requestedUrl: string;
  servedUrl: string;
  redirected: boolean;
  httpStatus: number;
  contentType: string;
  responseHeaders: Record<string, string>;
  etag?: string;
  lastModified?: string;
  bytes: number;
  sha256: string;
  storedAs: string;
  archivePath: string;
  retrievedAt: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function extensionFor(contentType: string): string {
  if (contentType.includes('pdf')) return 'pdf';
  if (contentType.includes('html')) return 'html';
  if (contentType.includes('json')) return 'json';
  if (contentType.includes('xml')) return 'xml';
  return 'bin';
}

export async function captureSource(params: {
  jurisdictionCode: string;
  tier: AuthorityTier;
  citation: string;
  url: string;
  requestHeaders?: Record<string, string>;
  rootDir?: string;
}): Promise<SourceCapture> {
  const { jurisdictionCode, tier, citation, url } = params;
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'OpenPolicy-RegulatoryResearch/0.1 (primary-source capture; contact via repository owner)',
      ...(params.requestHeaders || {})
    }
  });
  const body = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const sha256 = crypto.createHash('sha256').update(body).digest('hex');

  const dir = path.join(params.rootDir || path.join(process.cwd(), 'research', 'pr0b'), jurisdictionCode, 'sources');
  fs.mkdirSync(dir, { recursive: true });
  const storedAs = `${sha256}.${extensionFor(contentType)}`;
  // A non-success response is evidence of the failed exchange, not the requested
  // authoritative artifact. Keep it in a segregated failure archive so it can
  // never be mistaken for accepted source evidence.
  const archiveDir = response.ok ? dir : path.join(dir, 'failed-responses');
  fs.mkdirSync(archiveDir, { recursive: true });
  const target = path.join(archiveDir, storedAs);
  // Content-addressed: an identical capture never overwrites anything.
  if (!fs.existsSync(target)) fs.writeFileSync(target, body, { flag: 'wx' });

  const responseHeaders = Object.fromEntries(
    [...response.headers.entries()].filter(([name]) => !['set-cookie', 'set-cookie2', 'authorization', 'proxy-authorization'].includes(name.toLowerCase()))
  );

  const capture: SourceCapture = {
    jurisdictionCode,
    tier,
    citation,
    requestedUrl: url,
    servedUrl: response.url || url,
    redirected: response.redirected,
    httpStatus: response.status,
    contentType,
    responseHeaders,
    ...(response.headers.get('etag') ? { etag: response.headers.get('etag')! } : {}),
    ...(response.headers.get('last-modified') ? { lastModified: response.headers.get('last-modified')! } : {}),
    bytes: body.length,
    sha256,
    storedAs,
    archivePath: path.relative(process.cwd(), target).replaceAll('\\', '/'),
    retrievedAt: new Date().toISOString()
  };
  fs.appendFileSync(path.join(dir, response.ok ? 'manifest.jsonl' : 'failed-attempts.jsonl'), JSON.stringify(capture) + '\n');
  if (!response.ok) {
    throw Object.assign(new Error(`Capture failed for ${url}: HTTP ${response.status}`), { capture });
  }
  return capture;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('capture-source.ts');
if (invokedDirectly) {
  const jurisdictionCode = arg('jurisdiction');
  const tier = arg('tier') as AuthorityTier | undefined;
  const citation = arg('citation');
  const url = arg('url');
  if (!jurisdictionCode || !tier || !citation || !url || !['A', 'B', 'C', 'D', 'DISCOVERY'].includes(tier)) {
    console.error('Usage: tsx scripts/pr0b/capture-source.ts --jurisdiction NV --tier A|B|C|D|DISCOVERY --citation "<citation>" --url <official url>');
    process.exit(2);
  }
  captureSource({ jurisdictionCode, tier, citation, url })
    .then(c => console.log(JSON.stringify(c, null, 2)))
    .catch(err => {
      console.error(err.message || err);
      process.exit(1);
    });
}
