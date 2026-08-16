# Zero marginal AI inference cost

Buddie optimizes for **premium experience + minimum necessary compute**.
Experience is never degraded solely to hit an arbitrary cost target.

## Claim scope (precise)

**Target:** ZERO MARGINAL **AI INFERENCE** COST FOR THE CORE EXPERIENCE.

This does **not** mean zero infrastructure cost. Database, bandwidth, email,
monitoring, storage, hosting, and similar spend still exist and must not be
marketed as “zero cost.”

## Routing priority

1. **Soul Engine** (deterministic local) — default for nearly all product moments
2. **Local lightweight** (adaptive / tiny enricher) — still $0 inference, never blocking
3. **Browser/device-local computation** — capability detection; same character everywhere
4. **User-owned intelligence** — only where legitimately supported; BYOK storage disabled
5. **User-authorized / Buddie-funded remote** — only if explicitly configured
   (`BUDDIE_USER_AUTHORIZED_INTELLIGENCE`) **and** an ops-approved gap exists
6. **Fallback remote** — suppressed by default; prefer excellent local reply

`requiresAdvancedIntelligence` is **observability only**. It does **not**
auto-escalate to paid inference.

## Never escalate (expensive intelligence forbidden)

Greetings, acknowledgements, check-ins, rituals, orb interactions, basic emotional support,
navigation, settings, subscription questions, static product info, repeated deterministic
requests, and simple memory retrieval stay on Soul Engine.

## Controls

| Control | Module |
|--------|--------|
| Capability detection | `device-capabilities.ts` |
| Local routing | `cost/routing.ts`, `cost/resolve.ts` |
| Confidence scoring | Soul Engine + metrics |
| Context minimization | `cost/context-minimize.ts` |
| Safe response caching | `cost/cache.ts` (user-scoped) |
| Local memory summarization | `memory/summarize-local.ts` |
| Deduplication | Soul primitives + variation |
| Request coalescing | `cost/coalesce.ts` |
| Rate limiting / abuse | `cost/abuse.ts` |
| Credential / proxy policy | `cost/credential-policy.ts` |

## Cache

- Deterministic, **user-scoped** keys only (`user:…` / `session:…`)
- Never shared/global caches for private replies
- Memory-cited / deep replies are not cache-safe

## Abuse protection

Per-user + IP windows, request-size cap (800), conversation depth/turn caps,
external retry limits, provider timeout, and a failure circuit breaker.

Soft user copy only — no provider/infrastructure leakage.

## Observability (internal only)

Tracked fields:

- `local_responses`
- `local_confidence`
- `advanced_route_count`
- `fallback_count`
- `estimated_external_cost`

Plus rates: `local_resolution_rate`, `external_resolution_rate`, `cache_hit_rate`,
`coalesce_hit_rate`, latency / error / provider failure.

**Do not** expose these counters or provider names in the product UI.

Ops snapshot: `buildInternalCostTelemetry()` and
`GET /api/internal/intelligence-cost` (secret-gated; 404 when secret unset).

## Hard rules

- No hidden API proxy for arbitrary provider requests
- No public endpoint that forwards user text to OpenAI/Anthropic/etc.
- No insecure storage of user-supplied provider API keys (BYOK disabled)
- Authorized adapters (if ever enabled) use server-side config only

## Code

- `src/intelligence/cost/` — routing, cache, abuse, metrics, coalesce, minimize, telemetry, resolver
- Product facade: `lib/buddy-intelligence.ts` → `resolveIntelligence`
