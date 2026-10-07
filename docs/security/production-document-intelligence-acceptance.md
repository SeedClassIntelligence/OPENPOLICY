# Open Policy Production Data & Document Intelligence Acceptance

## Control record

- Accepted persistence baseline: `ac6d39e`
- Canonical working branch: `claude/eager-curie-yqreig`
- Authorized GCP project: `openpolicy-35f82`
- Prohibited GCP project: `openpolicy-510702`
- Deployment and merge: not authorized until this gate is complete
- Initial disposition: **NOT READY — REAL DOCUMENT PATH NOT IMPLEMENTED**
- External-service activation disposition (2026-10-07):
  **READY — REAL EXTRACTION IMPLEMENTATION**
- Local implementation candidate (2026-10-07): `3f4176e`
- Local implementation disposition: **READY FOR ZERO-TRAFFIC EXTERNAL ACCEPTANCE**

## Founder-authorized objective

A real consumer must be able to submit an actual insurance declarations document and
have Open Policy convert that evidence into a trustworthy, consumer-verified policy and
immutable coverage baseline. Sample selection, caller-supplied extraction, document
metadata without stored bytes, and substitution of canned policy data do not satisfy
this gate.

## Ownership and lifecycle authority

| Concern | Authority |
|---|---|
| Request identity and document ownership | Verified Firebase consumer UID |
| Original document bytes | Private Google Cloud Storage object in `openpolicy-35f82` |
| Upload/extraction/verification workflow | PostgreSQL |
| Extraction output | Versioned machine observation, never verified business truth |
| Insurance vocabulary and normalization | Existing `Policy`, `CoverageItem`, `SourceEvidence`, vehicle and driver types |
| Ambiguity and low confidence | Existing review-queue/governance boundary |
| Consumer correction and confirmation | Explicit authenticated consumer action with field-level history |
| Verified policy and baseline | PostgreSQL transaction after validation and consumer confirmation |
| Audit evidence | Existing append-only durable audit chain |

Authentication establishes the Firebase UID. Authorization independently establishes
that the UID owns the upload, extraction, correction, policy and baseline involved in
each operation.

## Required state sequence

`UPLOAD_PENDING -> UPLOADED -> VALIDATING -> REJECTED | EXTRACTION_PENDING ->`
`EXTRACTING -> REVIEW_REQUIRED | READY_FOR_CONSUMER -> CONSUMER_CORRECTED ->`
`CONSUMER_VERIFIED -> BASELINE_CREATED`

Every transition is conditional and durable. Retries return the already-created object
or continue the same operation; they must not create duplicate objects, extraction
runs, policies, baselines, notifications or audit events.

## Implementation requirements

### Secure ingestion

- Accept actual bytes, not a browser-provided path or extracted text.
- Enforce authenticated consumer ownership before issuing or accepting an upload.
- Generate server-controlled object names; never use user filenames as storage paths.
- Store originals in a private bucket with public access prevention and uniform
  bucket-level access.
- Encrypt in transit and at rest, retain SHA-256 and byte length, and record object
  generation so later processing is bound to immutable bytes.
- Permit only the explicitly supported document formats and enforce byte/page limits.
- Validate magic bytes and parsed format independently of filename and MIME headers.
- Quarantine until file validation and malware disposition succeed.
- Never log document bytes, OCR text, signed URLs, tokens, policy numbers, VINs,
  addresses or other extracted personal information.

### Extraction and normalization

- Extraction runs server-side against the quarantined object generation.
- Preserve extractor name/version, run ID, timestamps and whole-document hash.
- Every normalized fact carries page/location, source snippet or source-region
  reference, confidence, and machine/consumer verification state.
- Unsupported, contradictory, missing-critical or low-confidence facts enter review;
  they are never silently guessed or replaced with sample values.
- Model output is untrusted data. It cannot choose object identifiers, ownership,
  authorization, workflow status or database statements.
- The existing insurance vocabulary is extended deliberately where a real document
  proves it insufficient; combined legacy coverage codes are not destructively
  rewritten.

### Consumer correction and verification

- The consumer sees normalized fields together with source provenance.
- Corrections append field-level before/after evidence and actor/time; they do not
  rewrite the stored original or erase machine observations.
- Verification requires an explicit authenticated action and the current extraction
  version. A stale extraction cannot be verified after reprocessing.
- Policy creation and baseline activation occur in one PostgreSQL transaction with
  ownership validation, immutable evidence linkage and required audit events.
- Baseline creation is blocked for unresolved critical ambiguity, failed validation,
  malware, missing document bytes or ownership mismatch.

## Prohibited shortcuts

- No sample-policy fallback on a production upload failure.
- No client-supplied `consumerId`, verified status, confidence, hash or extracted terms
  as authority.
- No raw document or OCR body in PostgreSQL JSON payloads, logs or browser bundles.
- No public bucket/object ACL, permanent download URL or committed service credential.
- No synchronous request that reports success before storage/database commit.
- No automatic legal/compliance conclusion from extraction alone.
- No changes to Custody-Core, Commercial Economics or jurisdiction architecture.

## Required acceptance evidence

1. Real PDF upload and byte-for-byte hash/object-generation proof.
2. MIME spoof, oversized file, malformed PDF, active-content and malware rejection.
3. Cross-consumer object, extraction, correction and verification denial.
4. Storage/database/extractor failure rollback or recoverable state proof.
5. Duplicate upload/finalize/extract/verify retry idempotency.
6. Restart and cross-instance continuation from PostgreSQL plus Cloud Storage only.
7. Page-level provenance and confidence for every activated policy field.
8. Low-confidence, conflicting and missing-critical-field review behavior.
9. Consumer correction history and stale-extraction verification rejection.
10. Atomic verified-policy plus immutable-baseline creation and audit evidence.
11. Log, browser-bundle and repository secret/PII inspection.
12. Existing canonical, authorization, security, TypeScript and production-build gates.
13. Clean detached checkout with clean `npm ci`.
14. Exact-revision zero-traffic deployment and live real-document acceptance before
    traffic promotion.

## External configuration required

- a private Cloud Storage bucket in `openpolicy-35f82` with retention/lifecycle policy;
- least-privilege bucket permissions for the Cloud Run runtime identity;
- a malware-scanning service or approved quarantine/scan integration;
- an approved OCR/document extraction service and its region/processor identifier;
- Secret Manager/configuration values for those integrations;
- a non-sensitive test declarations document whose use is authorized;
- retention, deletion and consumer-export policy decisions.

No credential, processor identifier, legal retention period or production test document
will be fabricated. Missing external configuration blocks live acceptance, not the
bounded local implementation and adversarial test work.

## External-service activation evidence — 2026-10-07

The external document boundary was activated in the authorized project
`openpolicy-35f82`. The prohibited project `openpolicy-510702` was not accessed.

### Provisioned and verified resources

- Private evidence bucket: `openpolicy-35f82-policy-quarantine` in `us-central1`,
  with uniform bucket-level access and public access prevention enforced.
- Private scanner buckets: `openpolicy-35f82-scan-input`,
  `openpolicy-35f82-scan-clean`, `openpolicy-35f82-scan-malicious`, and
  `openpolicy-35f82-clamav-cvd`, all in `us-central1` with uniform bucket-level
  access and public access prevention enforced.
- Document AI processor: `ea4e80cba9642690`, display name
  `Open Policy Evidence OCR`, type `OCR_PROCESSOR`, location `us`, state
  `ENABLED`.
- Malware scanner: private Cloud Run service `openpolicy-malware-scanner`,
  verified revision `openpolicy-malware-scanner-00003-fvr`, running Google's
  `gcs-malware-scanner` 3.6.0 with ClamAV 1.5.3. It scales to zero and is capped
  at one instance.
- Eventarc trigger: `openpolicy-scan-input-finalized` invokes the scanner for
  finalized objects in the private scan-input bucket.
- Signature maintenance: private CVD mirror seeded through `cvdupdate` 1.2.0;
  Cloud Scheduler job `openpolicy-malware-scanner-mirror-update` is enabled on
  `17 */2 * * *` UTC. A manual scheduler acceptance invocation completed with
  HTTP 200 after confirming main version 63, daily version 28146, and bytecode
  version 339 were current and writing regenerated Linux mirror metadata.

The application runtime retains `roles/documentai.apiUser`. The dedicated scanner
identity has only its scanner-bucket object permissions, bucket metadata read needed
for trigger validation, Eventarc receiver, private Cloud Run invocation, and Monitoring
metric-write authority. No service-account key or integration secret was created,
downloaded, committed, or exposed to the browser.

### Scanner acceptance

- A harmless synthetic PDF was scanned `CLEAN` and moved from scan input to the
  private clean bucket.
- The standard EICAR antivirus test signature was detected as
  `Eicar-Test-Signature` and moved from scan input to the private malicious bucket.
- Neither test object remained in the input bucket after disposition.
- The authorized real policy evidence (957,469 bytes; SHA-256
  `af3a5368bdff81a7734c43f6fa4f62b3b605ef121fd4f50b9ff59eaabdceadc3`)
  was scanned with signature database version 28146 and reached `CLEAN` in
  4.681 seconds. Its private clean-object generation is
  `1791375845697117`.

### OCR and classification acceptance

The exact scanner-clean real-policy bytes were processed by the Document AI OCR
processor in bounded page selections because the synchronous endpoint limits a
request to 15 pages in its default mode. All 66 pages returned successfully and
produced 160,967 OCR characters. OCR text remained in memory and was neither logged
nor persisted by the acceptance runner.

The existing evidence classifier evaluated the provider response in memory and
classified the document as `FULL_POLICY` with confidence `0.99`, with no review
required. Page-number provenance was established for coverage limits, declarations,
endorsement, policy-contract, definitions, exclusions, and total-premium indicators.
No extracted names, policy numbers, addresses, VINs, OCR text, tokens, or document
bytes were written to this report.

## Local implementation acceptance — `3f4176e`

The authenticated application path now connects immutable upload evidence to the
external scanner, exact-generation Document AI OCR, provider-neutral page/region
provenance, bounded field normalization, append-only consumer correction, explicit
consumer attestation, verified policy creation, and immutable version-one baseline
creation. Classification and normalization commit atomically with workflow state and
audit evidence. Verification commits the policy, baseline, final document state, and
both required audit events in one PostgreSQL transaction.

No caller-supplied policy object is accepted by the new verification route. The
consumer may correct only an explicit insurance-field allowlist. Ownership, workflow
state, confidence, object identity, extraction identity, policy identifiers, baseline
identifiers, and audit identity remain server-controlled. Missing vehicle or core
liability facts return a validation failure instead of receiving invented defaults.
Verification identifiers are deterministic for the document/extraction/owner tuple,
and retry acceptance proved the same policy and baseline are returned without
duplicates. Restart acceptance proved that original observations, corrections,
verified policy, baseline, ownership, and final workflow state continue from
PostgreSQL after an empty process restart. The corrected premium became baseline truth
while the original machine observation remained unchanged.

Local evidence on 2026-10-07:

- document-intelligence suite: **37/37**;
- authorization suite: **33/33**;
- adversarial HTTP probes: **19/19**;
- TypeScript: pass;
- production client and server builds: pass (existing bundle-size and ineffective
  dynamic-import warnings remain non-blocking performance debt);
- fresh detached checkout of exact `3f4176e`: clean `npm ci` installed 371 packages,
  TypeScript passed, and production client/server builds passed;
- canonical validator aggregate: **all 11 suites pass** — PM-1 57/57, PM-2 45/45,
  PM-3 34/34, PM-4 60/60, PM-5 89/89, Commercial Economics aggregate green,
  CE-3 135/135, CE-4 38/38, CE-5 42/42, semantic corrections 13/13, and
  PR-0A 180/180.

### Remaining external acceptance boundary

The complete product gate is not yet closed. Candidate `3f4176e` still requires live
execution of the real Root policy through authenticated ingestion, scan, OCR,
normalization, correction where required, explicit attestation, policy creation, and
immutable baseline verification before traffic promotion.

Retention, deletion, and consumer-export periods remain founder decisions. No legal
retention period or destructive lifecycle rule was inferred during activation.

## Zero-traffic deployment evidence — 2026-10-07

Exact application commit `3f4176e` was deployed to authorized project
`openpolicy-35f82` as Ready revision `openpolicy-acceptance-docintel-3f4176e`, tagged
`docintel-candidate`, with **0% traffic**. The incumbent accepted revision
`openpolicy-acceptance-persist-ac6d39e` continued receiving 100% of normal traffic.
The candidate tagged URL returned HTTP 200 from `/api/health` and HTTP 401 for
anonymous policy-document access.

Authenticated live-document execution is not yet complete. A temporary Firebase
consumer and matching Firestore profile were created twice and removed after each
attempt. Firebase Identity Toolkit rejected both server-side email/password sign-in
attempts with HTTP 403, including one carrying the authorized candidate Origin and
Referer. No API-key restriction was weakened, no reusable credential was retained,
and no document upload reached the candidate during these attempts. Live acceptance
therefore requires an interactive browser sign-in from an authorized Firebase origin
or another approved token-acquisition path that preserves the existing API-key
restriction. Traffic promotion remains prohibited until that authenticated workflow
and consumer-confirmed corrections complete successfully.
