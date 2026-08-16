# Dependency security remediation (production)

Date: 2026-08-16  
Repo: `baddiehubby/NEW_REPO` · `dashboard/`  
Baseline: `next@14.2.35` (latest 14.x)

## CURRENT (before remediation)

`npm audit --omit=dev`: **7 HIGH**

| # | Package | Vulnerable | Path | Fixed version | Next major? |
|---|---------|------------|------|---------------|-------------|
| 1 | `brace-expansion` | ≤1.1.17 / 2.0–2.1.3 / 5.0–5.0.8 | Sentry/minimatch, workbox/filelist | 1.1.18 / 2.1.4 / 5.0.9 | No |
| 2 | `fast-uri` | 3.0.0–3.1.4 | webpack → ajv | ≥3.1.5 / 4.x | No |
| 3 | `js-yaml` | ≤3.15.0 | `gray-matter` (blog frontmatter) | 3.15.1 | No |
| 4 | `nanoid` | ≤3.3.17 | `next` → `postcss` | ≥3.3.18 | No |
| 5 | `serialize-javascript` | ≤7.0.4 | `@ducanh2912/next-pwa` → workbox → terser | ≥7.0.5 / 7.1.0 | No (override; force would *downgrade* PWA) |
| 6 | `postcss` | ≤8.5.22 | nested under `next` | ≥8.5.23 | Bundled fix in **next@16.3.1**; override possible on 14/15 |
| 7 | `next` | &lt;16.3.1 (npm aggregate) | root | **16.3.1** per npm audit | **Yes** |

### Exploitability notes (Buddie)

- **brace-expansion / nanoid / serialize-javascript**: build-time / tooling DoS or RCE in serializers — not a direct user-facing API path; still remediable via overrides.
- **fast-uri**: AJV URI parsing in webpack schema tooling — build-time; override safe.
- **js-yaml**: `lib/blog.ts` parses local MD frontmatter — DoS if hostile YAML were ever ingested; patch to 3.15.1.
- **postcss**: CSS stringify / sourceMappingURL file read — primarily build pipeline; XSS stringify matters if attacker-controlled CSS is stringified into HTML (widget CSS is already sanitized separately). Override to ≥8.5.26.
- **next**: App Router DoS / cache / smuggling advisories — **network-reachable** on production App Router. **No `"use server"` actions** in tree (reduces some Server Action vectors) but RSC/App Router surface remains. **No patched 14.x.** Minimum security line for several CVEs is **15.5.15+**; npm audit clears the `next` package only at **16.3.1**.

## SAFE FIX (applied without Next major)

`package.json` `overrides`:

- `brace-expansion@1/2/5` → patched
- `fast-uri` → `^4.1.2`
- `js-yaml` → `3.15.1`
- `nanoid` → `^3.3.18`
- `postcss` → `^8.5.26`
- `serialize-javascript` → `^7.1.0`

Pinned `next` to `14.2.35` (already latest 14).

**Did not** run `npm audit fix --force`.

## REQUIRED MAJOR MIGRATION (for 0 HIGH)

After safe overrides, **only `next` remains HIGH**.

npm audit vulnerable range (post-override): **`next` 9.5.0 – 15.5.20**  
Force-fix still suggests `next@16.3.1`, but **`next@15.5.21+` is outside the audited HIGH range** and is the smallest major that can reach **0 HIGH** without jumping to 16.

| Target | Clears remaining HIGH? | Risk |
|--------|------------------------|------|
| Stay on 14.2.35 | No | — |
| **15.5.21+** (prefer latest 15.5.x) | Yes (per current audit range) | Major: App Router / middleware / PWA / Sentry |
| 16.3.1 | Yes (npm `--force` suggestion) | Higher major risk |

### Compatibility snapshot (current)

| Component | Current | Notes |
|-----------|---------|-------|
| Next | 14.2.35 | App Router + middleware |
| React | 18.2 | Next 15/16 peers allow React 18 |
| next-auth | 4.24.15 | Peers include Next 14/15/16 |
| @ducanh2912/next-pwa | 10.2.9 | `next>=14` |
| @sentry/nextjs | 10.x | Peers include Next 15/16 |
| Middleware | Edge JWT gate + CSP/HSTS | Re-test cookies/`matcher` on 15 |
| Route handlers | `app/api/**` | Expect mostly compatible |
| CSP | middleware + headers | Re-validate after upgrade |
| Vercel | standard Next deploy | Confirm Node runtime |

### Migration risk

**HIGH** — Auth cookies, Lemon webhooks, widget credential exchange, PWA/Workbox, Sentry wrap. Dedicated branch + full regression required. **Do not auto-merge into RC without canary.**

### Recommended migration steps (do not auto-run)

1. Branch `chore/next-15-security`.
2. Upgrade `next` + `eslint-config-next` to **≥15.5.21** (latest 15.5.x preferred); keep React 18.
3. Keep `overrides.postcss` (≥8.5.26) — Next 15.5.x still vendors `postcss@8.4.31` without override.
4. Run lint/typecheck/test/build; fix middleware/PWA/Sentry breakages.
5. Confirm `npm audit --omit=dev` → **0 HIGH**.
6. Manual: login/OAuth, Lemon return, widget bind, PWA.
7. Only then merge.

## AFTER SAFE FIX (verified 2026-08-16)

| Metric | Before | After |
|--------|--------|-------|
| HIGH (`npm audit --omit=dev`) | **7** | **1** (`next` only) |
| Lint / typecheck / test / build / secret scan | — | **PASS** (221 tests) |

Remaining HIGH cannot be cleared on Next 14. Smallest major for 0 HIGH: **`next@≥15.5.21`** (keep `postcss` override).
