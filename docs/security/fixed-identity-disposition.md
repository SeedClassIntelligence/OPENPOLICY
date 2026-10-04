# Fixed identity and organization occurrence disposition

Review scope: runtime TypeScript under `server.ts`, `src/server`, and `src/domain` after Phase 2 remediation.

| Occurrence family | Disposition | Reason |
|---|---|---|
| `org_apex` in `InMemoryDatabase.seed()` and `PostgresStore` seed synchronization | MIGRATION/SEED_ONLY | Canonical marketplace fixture organization, license, invitation, offers, and participation. It represents intentional historical/test data and is not used to infer a caller. |
| `org_apex` in domain and validator test files | FIXTURE_ONLY | Explicit test actors and cross-tenant cases. |
| `seedCompetitorOffers()` Apex values | FIXTURE_ONLY | Synthetic demo generator. Its HTTP route is denied in Firebase mode pending an explicit production actor decision; canonical validators may reach it only through the process-only fixture bypass. |
| `user_consumer_1` in database seed records and historical seed audit events | MIGRATION/SEED_ONLY | Canonical fixture consumer and historical records. |
| `user_consumer_1` in `resolveFixtureIdentity()` | FIXTURE_ONLY | Used only when `OPENPOLICY_AUTH_MODE=fixture`; fixture mode throws under `NODE_ENV=production`. |
| `system_reconciliation_engine` audit actor | DISPLAY/NON-AUTHORITY | Audit attribution only when an explicitly system-triggered reconciliation runs; it does not establish ownership or authorize the operation. |
| Challenge creation fixed consumer | RUNTIME_AUTHORITY — REMOVED | Replaced with verified consumer UID from `getAuthenticatedConsumerId`. |
| Vault upload fixed/default consumer owner | RUNTIME_AUTHORITY — REMOVED | Route overwrites caller input with verified consumer UID; database rejects a missing owner. |
| Binding consent `handoff.providerOrganizationId || 'org_apex'` | RUNTIME_AUTHORITY — REMOVED | Missing provider organization now fails closed. |
| Reconciliation/commercial projection `handoff?.providerOrganizationId || 'org_apex'` | RUNTIME_AUTHORITY — REMOVED | Projection now requires the handoff's authoritative organization and throws when absent. |
| Commercial backfill `offer?.providerId || 'org_apex'` | RUNTIME_AUTHORITY — REMOVED | Backfill now fails if an offer has no authoritative provider organization. |
| Browser Firestore demo records on missing/mismatched identity or permission denial | RUNTIME DATA FALLBACK — REMOVED | Direct browser reads now throw on missing identity or Firestore denial; demo consumer data can no longer substitute for another actor's records. |
| PostgreSQL challenge owner `usr_consumer_default` | RUNTIME AUTHORITY — REMOVED | Durable challenge persistence now rejects a challenge without an authoritative consumer owner. |
| Consumer request-body fixed/default consumer IDs | REQUEST HINT — REMOVED | The server already derives consumer UID; removing these fields prevents future accidental reuse as ownership evidence. |

No remaining `org_apex` occurrence is permitted to answer “which organization owns this runtime resource?” Seed and fixture occurrences remain because they are legitimate canonical test data.
