# Open Policy Functional Conduct Inventory

**Jurisdiction:** Nevada  
**Purpose:** Factual input for analysis of whether Open Policy sells, solicits, or negotiates insurance  
**Status:** Product description only; legal conclusions remain unverified  
**Related research:** `DOSSIER.md`, `SOURCE-INVENTORY.json`, `CAPTURE-REPORT.json`, and `GAP-REGISTER.md`

## Existing Nevada Research Record

The repository already contains a Nevada research package. Official Nevada statutory chapters, NAC materials, Division of Insurance licensing pages, bulletins, filing materials, and capture evidence have been archived.

The capture report establishes that 44 authoritative sources were archived. The existing Nevada dossier is not yet a completed function-by-function legal analysis of Open Policy's conduct. The May 2022 Nevada Division of Insurance referral-fee memorandum must also be specifically confirmed within the archive or added before relying on its language.

## What Open Policy Is

Open Policy is a consumer-controlled insurance-policy comparison and provider-handoff platform.

A policyholder supplies evidence of the insurance policy they already have. Open Policy converts that document into structured coverage facts, allows the policyholder to verify or correct those facts, and creates a durable baseline representing the existing policy.

Licensed and authorized insurance providers may review the limited policy information the consumer has authorized for that purpose. Each provider independently decides whether to participate and, if it chooses to participate, prepares and submits its own documented insurance offer.

Open Policy then presents factual differences between the consumer's existing policy and the provider's offer. The consumer decides whether to retain the existing policy or select an offer.

Open Policy does not itself issue insurance, bind coverage, underwrite the consumer, set insurance terms, determine premiums, negotiate with a carrier, select an offer for the consumer, or guarantee that the consumer will save money.

## Consumer Process

The implemented consumer journey is:

1. The consumer creates a policyholder account.

2. The consumer uploads an existing insurance-policy document, normally a declarations page or full policy.

3. Open Policy:

   - securely receives the document;
   - validates and scans the uploaded file;
   - extracts policy facts;
   - records the source and confidence associated with extracted facts;
   - presents the facts to the consumer for confirmation or correction.

4. The consumer verifies information including:

   - named insured;
   - carrier;
   - policy number;
   - policy effective and expiration dates;
   - insured vehicles or other covered property;
   - coverage types;
   - limits;
   - deductibles;
   - current premium;
   - relevant policy attributes.

5. Once confirmed, Open Policy creates a durable coverage baseline. This baseline represents the policy the consumer currently has. It is not a request for a different policy and does not contain consumer-created target prices or desired replacement terms.

6. The consumer authorizes limited policy information to be used for provider review.

7. Eligible providers independently decide whether to review the opportunity and submit an offer.

8. The consumer may receive multiple valid offers. Open Policy preserves and displays every valid documented offer rather than choosing a preferred offer.

9. Open Policy compares each offer with the existing-policy baseline field by field.

10. The consumer may:

    - review an offer;
    - review the factual differences;
    - request or provide permitted factual information;
    - select an offer;
    - retain the existing policy;
    - allow the submission window to expire without selecting anything.

11. If the consumer selects an offer, the consumer grants scoped consent for the selected provider to receive the information needed for the handoff.

12. The licensed provider then performs the subsequent insurance transaction through its authorized channel, including application completion, underwriting, final terms, binding, and issuance.

13. Open Policy may receive evidence of the issued policy and compare it with the offer the consumer selected.

14. The consumer can see whether the issued policy matches the selected offer and can retain the resulting documents and policy record in the Policy Vault.

The consumer does not pay to participate in this process.

## Provider Process

A provider cannot participate merely by creating a public account. Provider participation is supposed to depend upon organization, user, licensing, appointment, jurisdictional, and marketplace authority.

The provider journey is:

1. A provider creates or receives access to a provider account and organization.

2. Open Policy verifies the relevant provider information, including as applicable:

   - provider organization;
   - individual provider user;
   - marketplace status;
   - producer licensing;
   - jurisdiction;
   - line of authority;
   - carrier appointment or broker authority;
   - applicable effective dates;
   - commercial participation status.

3. A provider is exposed only to opportunities for which it passes the applicable participation controls.

4. Before selection, the provider receives an appropriately limited policy-risk profile. The system is designed to avoid disclosing the consumer's identity and direct contact information at this stage.

5. The provider independently decides whether it wants to participate.

6. If participating, the provider develops its own insurance terms through its licensed insurance operations. Open Policy does not create those terms for the provider.

7. The provider submits a documented offer containing:

   - carrier;
   - premium;
   - effective and expiration dates;
   - coverage;
   - limits;
   - deductibles;
   - required supporting quote documentation;
   - other factual offer terms.

8. Open Policy verifies objective conditions such as:

   - provider authority;
   - carrier relationship or appointment;
   - supporting documentation;
   - date validity;
   - completeness;
   - consistency between submitted information and the supporting document;
   - factual comparability.

9. Open Policy does not require a minimum price reduction. A valid offer can be:

   - less expensive;
   - more expensive;
   - differently structured;
   - broader in some areas;
   - narrower in some areas.

10. The provider cannot see competing providers' offers and does not receive signals telling it to reduce its price or change its terms.

11. While the submission window remains open, a provider may independently correct or update its own quote. Earlier versions remain preserved as immutable history.

12. After the consumer selects an offer, the provider receives the authorized consumer information through the controlled disclosure and handoff process.

13. The provider conducts application, underwriting, binding, and issuance through its licensed channel.

14. If the selected offer cannot be honored as submitted, the provider may report that fact using controlled reason information. Open Policy does not operate a counteroffer or renegotiation workflow.

15. The provider may submit evidence of the issued policy so Open Policy can reconcile it against the selected offer.

## What Open Policy Does Not Do

The current founder-approved operating model specifically rejects the following conduct:

- No auction or bidding process.
- No ranking of providers.
- No "winning" provider selected by the platform.
- No recommended insurer or offer.
- No minimum-savings requirement.
- No platform-created insurance requirements.
- No consumer-created target price or target coverage.
- No improvement rounds.
- No best-and-final round.
- No provider signals about competitors.
- No platform-generated pressure to change price or terms.
- No post-selection counteroffers.
- No platform-managed renegotiation.
- No binding or issuance by Open Policy.
- No guarantee of savings or coverage superiority.

## Comparison and Explanation Functions

This is the most important area for the Nevada legal analysis.

Open Policy produces a deterministic field-by-field comparison between the existing policy and an offer. It can show:

- baseline value;
- offered value;
- numerical difference;
- whether a coverage is present or absent;
- increased or reduced limits;
- changed deductibles;
- annual premium difference;
- material coverage reductions;
- classifications such as equivalent, different, higher, or lower.

The application also has a plain-language explanation function. Its intended role is to explain what the recorded differences mean, not to recommend what the consumer should buy. The deterministic comparison remains the authoritative record; the AI explanation is not supposed to invent facts or replace the actual policy documents.

Nevertheless, these functions require close legal review because labels such as "better," "worse," "material reduction," or explanatory statements about coverage benefits may be characterized differently from a purely mechanical display of source data. That is the strongest candidate for a Nevada "negotiate" concern.

Counsel should separately analyze:

- raw side-by-side factual display;
- arithmetic premium differences;
- coverage classifications;
- material-reduction warnings;
- plain-language coverage explanations;
- any statement suggesting which choice protects the consumer better;
- any call to action accompanying those statements.

## Invitations and Provider Matching

Open Policy may determine which providers are operationally eligible to review a policy based on factors such as:

- state and line authority;
- active license or appointment evidence;
- product appetite;
- marketplace status;
- commercial capacity.

That matching does not itself determine which offer the consumer should select. Providers independently choose whether to submit an offer, and the consumer sees the resulting valid offers.

However, counsel should evaluate whether sending a consumer's opportunity to selected providers—or describing those providers to the consumer—could become solicitation if the interface urges the consumer toward a particular insurer or kind of policy.

Neutrality must therefore remain an operating control, not merely marketing language.

## Identity, Consent, and Disclosure

Before selection, providers should receive only the information necessary to assess the authorized opportunity. They should not receive the consumer's identity or contact information simply because they can view the opportunity.

After selection:

- the consumer grants scoped consent;
- the selected provider becomes the authorized recipient;
- Open Policy records what information was disclosed;
- unrelated providers do not receive the information;
- revocation governs prospective disclosure;
- historical evidence of prior authorized disclosure is preserved.

This distinction matters legally because Open Policy does more than publish general information: it controls an information transfer that facilitates a subsequent insurance transaction. The exact disclosed fields, timing, and recipient must be part of the legal analysis.

## Commercial Model

Consumers participate without a recurring fee.

The provider-side commercial architecture supports:

- provider commercial agreements;
- subscription plans;
- included policy-review or engagement capacity;
- capacity overages where contractually configured;
- governed commercial events and billing records.

Commercial payment is architecturally separated from:

- provider licensing;
- provider authority;
- opportunity distribution;
- offer qualification;
- offer display;
- consumer selection;
- jurisdictional decisions.

Paying more is not supposed to produce placement, ranking, preferential distribution, or influence over consumer choice.

For the Nevada determination, architectural separation alone is insufficient. The counsel packet must state the exact active compensation terms:

- who pays Open Policy;
- how much;
- when a charge is generated;
- whether it depends on reviewing an opportunity;
- whether it depends on submitting an offer;
- whether it depends on consumer selection;
- whether it depends on binding or issuance;
- whether any provider, carrier, or producer shares commission revenue;
- whether any consumer receives value or an inducement.

Those facts must come from the activated commercial plan and actual agreements, not merely from what the software is capable of supporting.

## Function-by-Function Legal Questions

The Nevada analysis should not ask generally whether Open Policy is a "referral platform." It should ask, for each function:

| Open Policy function | Question requiring determination |
| --- | --- |
| Marketing and onboarding | Does any language urge a consumer to obtain a particular kind of insurance or use a particular insurer? |
| Provider eligibility and invitations | Is this neutral operational routing, or participation in solicitation? |
| Policy extraction | Is the platform merely recording document facts? |
| Baseline verification | Is the consumer confirming existing evidence, or receiving insurance advice? |
| Side-by-side comparison | Is this factual display, or advice concerning substantive contract benefits or terms? |
| Material-reduction warnings | Does warning about reduced coverage constitute advising? |
| AI explanations | Does explaining coverage amount to negotiation or insurance advice? |
| Offer qualification | Is the platform checking objective documentation and authority, or evaluating desirability? |
| Offer presentation | Are all valid offers presented neutrally and without ranking? |
| Selection | Is the decision exclusively the consumer's? |
| Consent and disclosure | Does the handoff constitute referral activity, solicitation, or another regulated function? |
| Provider compensation | Is Open Policy receiving valuable consideration for conduct falling within sell, solicit, or negotiate? |
| Binding and issuance | Does Open Policy perform any act reserved to a licensed producer or insurer? |
| Reconciliation | Is this post-transaction factual verification, or advice about policy suitability? |

## Current Assessment Boundary

The verified product facts support an argument that Open Policy does not sell insurance and deliberately avoids choosing or urging a particular provider.

The unresolved legal risk is comparison and explanation: whether describing substantive coverage differences—especially with evaluative labels or AI-generated explanations—constitutes negotiating or otherwise performing a producer-regulated function under the complete Nevada statutory language.

That issue cannot be resolved by changing the fee structure alone. It requires:

1. extracting the exact controlling provisions from the already captured official sources;
2. confirming or capturing the May 2022 Nevada Division of Insurance memorandum;
3. placing this functional-conduct inventory into the Nevada dossier;
4. mapping every function to the verified statutory elements;
5. recording the precise provider compensation arrangement;
6. obtaining Nevada insurance-counsel verification.

This document is the factual starting point for that analysis. It does not constitute a legal determination, regulatory approval, or authorization to activate Nevada production transactions.
