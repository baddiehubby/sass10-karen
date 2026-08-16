# Invisible device adaptation

**Product rule:** Every user experiences premium Buddie. Internals may differ; the character must not.

## Non-negotiable

Never show: iPhone/Android mode, WebGPU/WASM/unavailable, download model, API configuration, “voice is quiet” as an error, or any intelligence-path label.

## Runtime paths (internal only)

1. Deterministic Soul Engine (always ready)
2. Lightweight local composition
3. Optional tiny enricher (idle warmup — never blocks)
4. CSS orb first; WebGL lazy enhancement on capable desktops
5. Soft character presence if anything throws

Router: `getAdaptiveRuntime()` / `resolveIntelligenceStrategy()` — **do not render**.

## First load

- Orb + shell immediately (`ready: true`)
- `IntelligenceWarmup` uses `requestIdleCallback`
- WebGPU never required
- No model download gates onboarding

## Conversation

Failures → character-consistent presence via Soul Engine (or “I'm right here with you.”).  
Never surface `Error.message` or provider strings.

## Tests

`src/intelligence/invisible-adaptation.test.ts` — CSS on mobile UAs, no plumbing in replies, copy hygiene.
