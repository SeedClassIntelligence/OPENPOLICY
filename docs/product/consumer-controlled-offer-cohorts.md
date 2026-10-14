# Consumer-Controlled Offer Cohorts

## Product rule

One verified policy opportunity may activate multiple bounded provider cohorts during its one submission window. The consumer controls whether another cohort is activated. This is not an offer-improvement round, an auction, or a provider counteroffer mechanism.

## State distinctions

- **Standby:** the provider is eligible but has no access to the policy opportunity and receives no opportunity notification.
- **Activated:** the provider receives the existing privacy-preserving opportunity access and may independently decide whether to participate.
- **Submitted:** an activated, authorized participant has submitted its own documented offer.
- **Selected:** the consumer selected one immutable offer and may separately authorize the existing connection/handoff process.

## Invariants

1. The default activation cohort is 10 providers and the initial overall activation ceiling is 30 providers. These are configuration values on the durable competition record, not provider commercial entitlements.
2. Fewer eligible providers produce a smaller cohort. Open Policy never manufactures offers or relaxes eligibility to fill capacity.
3. Additional activation is consumer-only, transactional, idempotent, and permitted only while the original submission window remains open.
4. Closing the submission window for consumer review permanently prevents further cohort activation for that opportunity.
5. Standby providers receive no policy access, no invitation notification, and no billable availability event until activated.
6. Later providers receive no prior offers, consumer decline reasoning, pricing signal, or instruction to change terms.
7. Provider order is stable operational queue order, never a consumer-facing recommendation or pay-to-win ranking.
8. Provider identity, organization, jurisdictional authority, commercial capacity, participation, offer, consent, disclosure, and selection controls remain independently enforced.
9. Every activation produces durable marketplace activity, audit evidence, provider notification, and the existing commercial `VPO_AVAILABLE` projection.

## Consumer choices

While the submission window is open, the consumer may review submitted offers, request an additional provider cohort when standby capacity remains, retain the current policy, or close submissions and continue to final review. The interface reports factual counts and does not characterize existing offers as inadequate.

