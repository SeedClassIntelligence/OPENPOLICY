# Permanent name and domain gate

Date: October 18, 2026  
Status: **Founder selected `openpolici.com`; ownership verification pending**

## Founder decision

On October 18, 2026, the founder selected the exact permanent domain
`openpolici.com`. The spelling is intentional. Public-brand presentation as
`OpenPolici` remains the working interpretation for implementation; internal
historical identifiers do not need destructive renaming.

Verisign RDAP reports that `OPENPOLICI.COM` was registered on October 19, 2026
UTC through infrastructure using `ns1.siteground.net` and
`ns2.siteground.net`, with expiration on October 19, 2027. Google Cloud did not
yet list the domain as verified for the active account, and the apex and `www`
host did not yet resolve to application address records when inspected.

## Verified conflict

The working product name `Open Policy` cannot be treated as cleared for a
permanent public domain:

- `openpolicy.co` is actively used by an unrelated U.S. company, OpenPolicy,
  Inc.;
- that company publicly markets a software platform under the `OpenPolicy`
  name;
- U.S. trademark registration 8,375,963 for `OPENPOLICY` is reported live and
  registered in Class 9, with first commercial use claimed in 2023; and
- the same company has additional `OPENPOLICY` applications covering business
  and SaaS services, including Class 42.

Sources inspected:

- [OpenPolicy website terms](https://www.openpolicy.co/terms-of-use)
- [OPENPOLICY registration summary — serial 99412360](https://www.trademarkia.com/openpolicy-99412360)
- [OPENPOLICY SaaS application — serial 99412372](https://uspto.report/TM/99412372)

This is a material brand/domain collision, not proof of the final legal scope of
the other party's rights. Formal clearance remains a trademark-law question.
However, it is sufficient reason not to harden `Open Policy` into DNS, Firebase,
Stripe, email, callback URLs and public launch materials before a founder name
decision and appropriate clearance.

## Operational consequence

The current Cloud Run URL remains the accepted temporary production endpoint.
No permanent domain mapping, certificate, Firebase authorized-domain change,
Stripe redirect/webhook migration or public-email migration should occur until
the permanent name is selected.

## Required ownership step

Complete Google Search Console domain ownership verification for
`openpolici.com` using the domain's SiteGround DNS control. The official Google
verification workflow has been opened for the active account. Domain mapping
must not be created until Google reports ownership verified.

Once the name is decided, the implementation sequence is bounded:

1. verify domain and trademark availability;
2. acquire/control the domain;
3. map DNS and TLS to Cloud Run;
4. update canonical `APP_URL` and redirects;
5. add only the exact domain to Firebase authorized domains and browser-key
   referrers;
6. update Stripe return URLs and webhook destination as required;
7. update owner/support email identities and public legal documents;
8. run signed consumer/provider/admin smoke acceptance on the permanent origin;
9. confirm uptime monitoring and outage alerts use the permanent origin; and
10. retain the Cloud Run URL and prior revision as rollback paths.
