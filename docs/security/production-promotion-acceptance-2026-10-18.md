# Open Policy production promotion acceptance — 2026-10-18

## Disposition

**TECHNICAL RUNTIME PROMOTION ACCEPTED. CONTROLLED PUBLIC LAUNCH REMAINS
GATED.**

Revision `openpolicy-acceptance-carrier-7074f15` is Ready and receives 100% of
traffic for the canonical Cloud Run service in project `openpolicy-35f82`.
This record does not authorize Nevada connection-fee collection, additional
insurance lines, a repository merge, or claims of regulatory approval.

## Deployed artifact

- Revision: `openpolicy-acceptance-carrier-7074f15`
- Runtime source checkpoint: `7074f15`
- Image digest:
  `sha256:6e8a639da70f4c585f58fba3fee4538ec4efa8578b44fa96e0736ed2f54683ba`
- Canonical URL: `https://openpolicy-acceptance-63l7hngdka-uc.a.run.app`
- Traffic: 100%
- Runtime service identity:
  `openpolicy-runtime@openpolicy-35f82.iam.gserviceaccount.com`
- Durable database: Cloud SQL instance
  `openpolicy-35f82:us-central1:openpolicy-db`
- Authentication: Firebase, project `openpolicy-35f82`
- Live Stripe collections: disabled

Commit `93dc8aa` adds the reusable deployed Firebase role-acceptance harness
after the runtime checkpoint. It changes acceptance tooling only and is not a
runtime divergence from the deployed artifact.

## Pre-promotion acceptance

- Direct-carrier applications require current, independently verified
  certificate-of-authority evidence.
- Direct-carrier activation fails closed until authority evidence, a matching
  `OPEN_POLICY_COMMERCIAL_V2` agreement, and a fully settled membership invoice
  all exist.
- Concurrent canonical plan seeding is idempotent and race safe.
- The carrier-candidate Firebase browser referrer was added to the existing
  browser key without removing any prior referrer or API restriction.
- Signed candidate acceptance passed for consumer and provider identities,
  including cross-role denial.

## Post-promotion production evidence

The canonical production URL returned:

- HTTP 200 from `/api/health`;
- HTTP 401 for anonymous `/api/challenges` access;
- HTTP 200 for signed consumer challenge, Policy Vault and notification reads;
- HTTP 200 for signed provider organization and commercial-account reads;
- HTTP 403 when a non-admin provider attempted provider-user administration;
  and
- HTTP 403 when a consumer attempted provider-organization access.

Temporary Firebase acceptance identities and profiles were removed by the
acceptance harness. The promoted revision produced no error-level Cloud Run
log entries during the post-promotion verification interval.

## Current-source regression

Executed from the branch containing commit `93dc8aa` after production
promotion:

- canonical validators: 11/11 runs passed;
- PM-1: 57/57;
- PM-2: 45/45;
- PM-3: 32/32;
- PM-4: 58/58;
- PM-5: 89/89;
- commercial economics aggregate: zero failures across 139 checks;
- CE-3: 137/137 assertions;
- CE-4: 38/38 acceptance tests and 117/117 assertions;
- CE-5: 42/42 acceptance tests and 137/137 assertions;
- semantic corrections: 13/13;
- PR-0A: 187/187;
- onboarding, authorization and provider activation: 41/41;
- authorization, payment boundary and Firestore security: 51/51;
- TypeScript: passed; and
- production client and server builds: passed.

An initial parallel rerun failed before test execution because the constrained
Windows sandbox returned `uv_os_get_passwd ENOMEM`. The identical gates were
rerun outside that constraint and passed. This was an execution-environment
failure, not an application-test failure.

## Rollback readiness

The previously serving revision `openpolicy-acceptance-persist-ac6d39e`
remains deployed and tagged `persistence-candidate`. It is the immediate known
rollback target if production health, authentication or durable-state behavior
regresses. No rollback was required during this acceptance.

## Gates that remain intentionally open

1. **Nevada compensation determination.** Authorized-connection charging must
   remain fail closed until the applicable legal determination is approved and
   durably attached to the governing plan/version. This record is technical
   evidence, not legal advice or regulatory approval.
2. **Live collection activation.** `OPENPOLICY_LIVE_COLLECTIONS_ENABLED` remains
   `false`. Controlled Stripe payment/webhook acceptance is recorded separately;
   general live collection was not activated here.
3. **Permanent public domain.** The canonical service currently uses its Cloud
   Run URL. A permanent founder-selected domain still needs DNS, certificate,
   Firebase authorized-domain/browser-referrer, application URL, callback and
   final smoke verification. A read-only Cloud Run API inspection returned no
   domain-mapping resources for project `openpolicy-35f82`.
4. **Insurance-line activation.** A published V2 connection price is not proof
   that a line's ingestion, regulatory, provider-authority and operational gates
   passed. Only independently accepted lines may be enabled.
5. **Repository merge.** The working branch is pushed but remains unmerged.
   Merge requires separate founder authorization and a final comparison of the
   deployed runtime checkpoint plus later acceptance-only commits against the
   intended canonical branch.
6. **Operational alerting.** Read-only Cloud Monitoring API inspection returned
   no alert policies and no uptime-check configurations. Production health can
   be queried, but automated outage/error notification is not yet established.
   Creating it requires an authorized notification destination.

## Operational conclusion

Open Policy's promoted runtime is healthy and its tested consumer/provider
authorization boundaries remain intact. The product may continue controlled
acceptance on the canonical Cloud Run URL. It must not represent Nevada
connection-fee collection, unrestricted multi-line availability, permanent
public-domain readiness or repository merge as complete until the corresponding
gate above is closed with direct evidence.
