# Phase B Stage 2 Staging-Log Reconciliation

## Disposition

The relayed staging log contains useful field-inventory and neutral-interface
guidance, but it is not an authoritative implementation record. This file
records what was adopted, expanded, or rejected against the canonical branch.

## Adopted

- Homeowners, Renters, CGL, and BOP retain separate, versioned policy schemas.
- Consumer verification must mirror extracted source evidence and remain
  factual rather than advising the consumer what coverage to purchase.
- A declared-line/document-line conflict requires review.
- Ambiguous line evidence remains `INDETERMINATE`; the platform does not infer a
  line from a filename, account selection, or incomplete text.
- Property schemas now include source fields for construction/year-built,
  wind/hail deductible, and water-backup evidence where the document supplies
  them.

## Expanded

- Classification review is now coupled to the committed extraction
  disposition. A conflict cannot be persisted as `READY_FOR_CONSUMER` merely
  because field normalization succeeded.
- Homeowners and Renters share extraction infrastructure but not field
  requirements. Renters does not receive fabricated dwelling coverage.
- Homeowners and Renters now have a line-aware field normalizer that records
  only facts supported by page-level OCR evidence. Missing required baseline
  facts produce `REVIEW_REQUIRED`; they are not calculated or defaulted.
- CGL and BOP share commercial extraction infrastructure but remain distinct:
  BOP includes commercial-property and business-income evidence; CGL does not.
- Commercial lines remain fail-closed at the normalization boundary until
  their dedicated normalizers and acceptance evidence are implemented. They
  cannot fall through into the Personal Auto normalizer.

## Rejected

### Calculated or default coverage facts

The proposed `coverageB = 10% of Coverage A`, water-backup default `0`, and
Renters dwelling values written as `null` or `0` are rejected. Open Policy must
record what the source document says. Missing, absent, not applicable, excluded,
and zero are different facts and cannot be collapsed into one value.

### Second activation matrix

The proposed `multiLineActivationMatrix` is rejected. It would duplicate the
existing insurance-line registry, regional rollout configuration, durable
ruleset/readiness records, provider-authority evaluation, and market-activation
engine. It also asserted Nevada production activation without evidence.

The governing sequence remains:

`line implementation readiness → regional rollout availability → verified
jurisdiction rules → provider authority → durable market activation`

No static UI or code object can confer production authority.

### Nevada Personal Auto described as live production

The staging log's “Green - Live In Production” statement is not accepted as
evidence. Deployment availability, acceptance testing, regulatory verification,
and production market activation are separate states. Production authorization
must be read from the durable activation system and its verified prerequisites.
