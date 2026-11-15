import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Karen Android shell (Capacitor) — Google Play Store.
 *
 * Production path (recommended):
 *   WebView loads hosted Next.js via `server.url` (APIs/auth/Prisma stay on Vercel).
 *   `webDir: 'out'` = bootstrap splash from `npm run cap:prepare`.
 *
 * Do NOT enable permanent `output: 'export'` in next.config — it breaks Vercel APIs.
 * Optional offline static shell only: CAPACITOR_STATIC_EXPORT=1 (then set NEXT_PUBLIC_API_URL).
 *
 * Override:
 *   CAPACITOR_SERVER_URL=https://www.buddieai.com
 *   NEXT_PUBLIC_API_URL=https://www.buddieai.com
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://www.buddieai.com";

const config: CapacitorConfig = {
  appId: "com.yourcompany.karen",
  appName: "Karen",
  webDir: "out",
  server: {
    url: serverUrl.replace(/\/$/, ""),
    cleartext: true,
    androidScheme: "https",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#e11d48",
      sound: "beep.wav",
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
