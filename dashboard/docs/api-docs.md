# Buddy AI API & embed reference

Buddy AI ships as a Next.js dashboard plus a **single-file widget** (`livingface-widget.js`). This document covers how partners embed the Buddy and which HTTP endpoints power licensing, theming, and emotional intelligence telemetry.

## WordPress plugin

The monorepo includes `wordpress-plugin/` with `buddy-ai.php`, `readme.txt`, and `assets/`. Zip the folder (without a top-level wrapper) and upload via **Plugins → Add New → Upload** in wp-admin.

---

## Embed snippet

```html
<script
  src="https://YOUR_DOMAIN/widget/livingface-widget.js"
  data-hq-key="YOUR_LICENSE_KEY"
  data-hq-api="https://YOUR_DOMAIN"
  data-hq-position="bottom-right"
  async
></script>
```

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-hq-key` | Yes | License key from the Buddy AI dashboard. |
| `data-hq-api` | Yes | Origin of your Buddy AI deployment (no trailing slash). |
| `data-hq-position` | No | `bottom-right` (default), `bottom-left`, `top-right`, `top-left`. |

The widget reads AI assistant text in the page, updates the orb mood, and (when licensed) posts anonymous mood events to your Buddy AI analytics pipeline.

---

## `GET /api/licenses/verify`

Cross-origin friendly JSON.

**Query:** `key`, `domain`

**Returns:** `{ valid, plan, features, widgetConfig, moodOverride?, ... }`

Used by the widget on load and periodically to refresh theme + forced mood overrides.

---

## `GET /api/licenses/theme`

Returns remote theme payload for Pro/Agency licenses with custom theme enabled.

**Query:** `key`, `domain`

---

## `POST /api/analytics/event`

Anonymous mood telemetry (CORS enabled).

**JSON body:** `{ licenseKey, mood, domain?, timestamp? }`

**Moods:** `neutral`, `happy`, `thinking`, `concerned`, `excited`, `sleepy`

Buddy (free) plans may be rate-limited per license per UTC day; paid tiers stream unlimited events.

---

## `GET /api/challenge/report`

Authenticated PDF download for the viral Buddy Challenge.

**Query:** `licenseId` (must belong to the signed-in user)

Returns `application/pdf` with mood mix, horoscope, and Buddy advice.

---

## Lemon Squeezy checkout (dashboard)

`POST /api/lemonsqueezy/create-checkout` with `{ "tier": "pro" | "agency" }` returns `{ url }` for hosted checkout.

Webhook: `POST /api/lemonsqueezy/webhook` handles subscription lifecycle events and updates the matching license.

---

## Security notes

- Treat license keys like API keys.
- Bind licenses to domains from the dashboard when you need stricter verification.
- Widget endpoints are intentionally cookie-free; rely on HTTPS in production.
