import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Karen Android shell (Capacitor).
 *
 * This Next.js app uses API routes, middleware, Server Actions, and Prisma —
 * so a full `output: 'export'` static build is NOT viable for production.
 *
 * The native WebView loads the hosted Next.js app via `server.url`.
 * `webDir: 'out'` still holds a bootstrap page for offline/first paint.
 *
 * Override at build time:
 *   CAPACITOR_SERVER_URL=https://www.buddieai.com
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
