import fs from 'fs';
import path from 'path';
import { AuthorityTier, captureSource, SourceCapture } from './capture-source';

interface InventoryEntry { tier: AuthorityTier; citation: string; url: string }

const inventoryPath = process.argv[2] || path.join('research', 'pr0b', 'NV', 'SOURCE-INVENTORY.json');
const entries = JSON.parse(fs.readFileSync(inventoryPath, 'utf8')) as InventoryEntry[];
const succeeded: SourceCapture[] = [];
const failed: Array<{ citation: string; url: string; error: string; capture?: SourceCapture }> = [];
const manifestPath = path.join(path.dirname(inventoryPath), 'sources', 'manifest.jsonl');
const priorCaptures = new Map<string, SourceCapture>();
if (fs.existsSync(manifestPath)) {
  for (const line of fs.readFileSync(manifestPath, 'utf8').split('\n').filter(Boolean)) {
    const capture = JSON.parse(line) as SourceCapture;
    priorCaptures.set(capture.requestedUrl, capture);
  }
}

for (const entry of entries) {
  const existing = priorCaptures.get(entry.url);
  if (existing) {
    succeeded.push(existing);
    console.log(`[REUSED] ${entry.citation} ${existing.sha256}`);
    continue;
  }
  try {
    const capture = await captureSource({ jurisdictionCode: 'NV', ...entry });
    succeeded.push(capture);
    console.log(`[CAPTURED] ${entry.citation} ${capture.sha256}`);
  } catch (error) {
    const typed = error as Error & { capture?: SourceCapture };
    failed.push({ citation: entry.citation, url: entry.url, error: typed.message, capture: typed.capture });
    console.error(`[FAILED] ${entry.citation}: ${typed.message}`);
  }
}

const report = { inventoryPath, attempted: entries.length, succeeded, failed, completedAt: new Date().toISOString() };
const reportPath = path.join(path.dirname(inventoryPath), 'CAPTURE-REPORT.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ attempted: entries.length, succeeded: succeeded.length, failed: failed.length, reportPath }, null, 2));
process.exitCode = failed.length ? 1 : 0;
