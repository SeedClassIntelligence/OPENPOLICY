# Nevada Wave 0 — Stage 1 Gap Register

**Source lineage:** Imported from founder-supplied `deep-research-report (6).md` and reconciled with the later capture-ready findings in `deep-research-report (7).md`. The descriptions below preserve the original G-NV meanings; later source-resolution findings change disposition only.

| Gap ID | Original missing/inaccessible material | Current Stage 1 disposition |
|---|---|---|
| G-NV-001 | Exact raw bytes for all web artifacts | PARTIAL — 43/44 bounded inventory targets captured exactly with verified SHA-256; SERFF returned HTTP 403 and remains segregated as a failed exchange. |
| G-NV-002 | HTTP response metadata | RESOLVED FOR CAPTURED SET — manifest records actual status, sanitized available response headers, ETag/Last-Modified when supplied, exact byte length, redirects and archive path. |
| G-NV-003 | DOI Bulletins index direct page | RESOLVED — exact index response captured successfully with HTTP 200. |
| G-NV-004 | DOI Enforcements & Orders direct repository | PARTIAL — official index captured successfully; relevant historical order completeness remains bounded and unresolved. |
| G-NV-005 | DOI Personal Automobile Insurance and P&C filing pages via direct open | RESOLVED FOR IDENTIFIED TARGETS — personal-auto page and Review Standards Checklist both captured successfully with HTTP 200. |
| G-NV-006 | R125-18 DOI/staging artifact | RESOLVED — accepted Nevada Register R125-18A artifact captured and hashed. |
| G-NV-007 | Bulletin 89-002 standalone authoritative artifact | RESOLVED — official State of Nevada PDF captured and hashed. |
| G-NV-008 | Complete DOI bulletin historical set relevant to personal auto, privacy, e-transactions, producer fees and rebating | PARTIAL / OPEN — identified bulletin chain is queued; historical completeness cannot be inferred from those captures. |
| G-NV-009 | Carrier-specific approved election/rejection forms | CONDITIONALLY DEFERRED — capture only when an established Open Policy proposition depends on a particular approved carrier form; do not crawl the full SERFF corpus. |
| G-NV-010 | Current NevadaIVS specification files | RESOLVED FOR IDENTIFIED SET — government-direction bulletins, operational help surface and implementation guide captured and hashed; legacy Nevada LIVE captured separately and remains labeled historical. |

Stage 1 remains incomplete until the capture manifest and this register are updated from actual capture results. No entry authorizes candidate-rule extraction.
