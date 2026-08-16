# Zero-avoidable-cost engineering

Buddie optimizes for **premium experience + minimum necessary compute**.
Experience is never degraded solely to hit an arbitrary cost target.

## Routing priority

1. **Soul Engine** (deterministic local) — default for nearly all product moments
2. **Local lightweight** (adaptive / tiny enricher) — still $0, never blocking
3. **User-authorized intelligence** — only if explicitly configured (`BUDDIE_USER_AUTHORIZED_INTELLIGENCE`)
4. **Fallback intelligence** — only when genuinely required; otherwise local is preferred

## Never escalate (expensive intelligence forbidden)

Greetings, acknowledgements, check-ins, rituals, orb interactions, basic emotional support,
navigation, settings, subscription questions, static product info, repeated deterministic
requests, and simple memory retrieval stay on Soul Engine.

## Cache

- Deterministic, **user-scoped** keys only (`user:…` / `session:…`)
- Never shared/global caches for private replies
- Memory-cited / deep replies are not cache-safe

## Abuse protection

Per-user + IP windows, request-size cap (800), conversation depth/turn caps,
external retry limits, provider timeout, and a failure circuit breaker.

Soft user copy only — no provider/infrastructure leakage.

## Observability (internal)

`local_resolution_rate`, `external_resolution_rate`, `average_latency`, `error_rate`,
`provider_failure_rate`, `estimated_cost_per_active_user`, `cache_hit_rate`

Do not expose these counters or provider names in the product UI.

## Code

- `src/intelligence/cost/` — routing, cache, abuse, metrics, resolver
- Product facade: `lib/buddy-intelligence.ts` → `resolveIntelligence`
