# Frozen Historical Artifacts

Files in this directory are **evidence, not source**. They are never built,
imported, or modified. Development happens in the git source tree; ZIP
replacement is no longer a change-control mechanism.

| File | SHA-256 | Meaning |
|---|---|---|
| `OPENPOLICY_2026-10-02_CE5_COMPLETE.zip` | `f26447e46f874a178b069b8c5d3825e7aa2b65aa91aee2e380371d6b8dee3829` | CE-5-complete snapshot uploaded 2026-10-02 (`main` @ `cfef64a`). The source tree at commit `ad7d1d8` is a byte-exact extraction of it. |

The superseded pre-CE-3 snapshot `OPENPOLICY_2026-09-30.zip` remains
retrievable from git history at commit `5408603`.

## Contents of the CE-5 archive that are intentionally *not* in the source tree

| Entry | Reason excluded |
|---|---|
| `.env` | Local configuration. Inspected: `GEMINI_API_KEY` is empty and `APP_URL`/`PORT` are localhost values, so no credential was exposed. Use `.env.example`. |
| `OPENPOLICY_2026-10-02.zip` | An earlier intermediate snapshot (9 files differ from the final tree) |
| `OPENPOLICY_checkpoint_20260928.zip` | 64.6 MB: local PGlite database state (`data/`), build output (`dist/`) and an older source copy |
| `scratch_directive*.txt` | Prompt text given to a previous coding agent. It is not runtime material. |

Verify an archive with `sha256sum archive/<file>`.
