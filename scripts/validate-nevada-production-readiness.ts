import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type Authority = { sha256?: string; archivePath?: string };
type Candidate = {
  ruleId: string;
  researchStatus: string;
  verificationStatus: string;
  primaryAuthority: Authority;
  supportingAuthorities?: Authority[];
};

type CandidateFile = {
  jurisdictionCode: string;
  insuranceLine: string;
  publicationStatus: string;
  rules: Candidate[];
};

const root = process.cwd();
const candidatePath = path.join(root, 'research', 'pr0b', 'NV', 'STAGE-2-CANDIDATE-RULES.json');
const manifestPath = path.join(root, 'research', 'pr0b', 'NV', 'PRODUCTION-READINESS-MANIFEST.json');
const candidates = JSON.parse(fs.readFileSync(candidatePath, 'utf8')) as CandidateFile;
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
  candidateRuleIds: string[];
  activationGates: Array<{ gateCode: string; status: string; evidenceRefs: string[] }>;
};

const failures: string[] = [];
const sourceFiles = new Set<string>();

if (candidates.jurisdictionCode !== 'NV') failures.push('Candidate jurisdiction must be NV.');
if (candidates.insuranceLine !== 'PERSONAL_AUTO') failures.push('Candidate insurance line must be PERSONAL_AUTO.');
if (candidates.publicationStatus !== 'UNPUBLISHED') failures.push('Candidate packet must remain UNPUBLISHED.');
if (candidates.rules.length !== 26) failures.push(`Expected 26 candidate rules; found ${candidates.rules.length}.`);

for (const rule of candidates.rules) {
  if (rule.verificationStatus !== 'UNVERIFIED') failures.push(`${rule.ruleId}: unexpected verification status ${rule.verificationStatus}.`);
  for (const authority of [rule.primaryAuthority, ...(rule.supportingAuthorities || [])]) {
    if (!authority.archivePath || !authority.sha256) {
      failures.push(`${rule.ruleId}: authority is missing archivePath or sha256.`);
      continue;
    }
    const sourcePath = path.join(root, authority.archivePath);
    sourceFiles.add(authority.archivePath);
    if (!fs.existsSync(sourcePath)) {
      failures.push(`${rule.ruleId}: archived source is missing: ${authority.archivePath}.`);
      continue;
    }
    const actual = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
    if (actual !== authority.sha256) failures.push(`${rule.ruleId}: source hash mismatch: ${authority.archivePath}.`);
  }
}

const candidateIds = candidates.rules.map(rule => rule.ruleId).sort();
const manifestIds = [...manifest.candidateRuleIds].sort();
if (JSON.stringify(candidateIds) !== JSON.stringify(manifestIds)) failures.push('Readiness manifest candidate IDs do not exactly match the 26-rule packet.');

const requiredGates = [
  'PROVIDER_AUTHORITY_READY', 'LEGAL_REVIEW_COMPLETE', 'DOCUMENT_REQUIREMENTS_READY',
  'SECURITY_READY', 'OPERATIONAL_RUNBOOK_READY', 'MARKET_APPROVED'
].sort();
const manifestGates = manifest.activationGates.map(gate => gate.gateCode).sort();
if (JSON.stringify(requiredGates) !== JSON.stringify(manifestGates)) failures.push('Readiness manifest does not contain the exact six production activation gates.');
for (const gate of manifest.activationGates) {
  if (gate.status !== 'PENDING') failures.push(`${gate.gateCode}: pre-publication manifest status must remain PENDING.`);
  if (gate.evidenceRefs.length === 0) failures.push(`${gate.gateCode}: required evidence references are missing.`);
}

const counts = candidates.rules.reduce<Record<string, number>>((result, rule) => {
  result[rule.researchStatus] = (result[rule.researchStatus] || 0) + 1;
  return result;
}, {});

if (failures.length > 0) {
  console.error('NEVADA PRODUCTION READINESS: FAIL');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('NEVADA PRODUCTION READINESS: PREPARATION PASS');
console.log(`Candidates: ${candidates.rules.length} (all UNVERIFIED and UNPUBLISHED)`);
console.log(`Research status: ${Object.entries(counts).map(([status, count]) => `${status}=${count}`).join(', ')}`);
console.log(`Archived official sources checked: ${sourceFiles.size}`);
console.log(`Activation gates declared: ${manifest.activationGates.length} (all PENDING)`);
console.log('Production publication and activation remain blocked until attributable founder dispositions and gate evidence are recorded.');
