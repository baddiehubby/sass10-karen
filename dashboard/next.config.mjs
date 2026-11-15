import { withSentryConfig } from "@sentry/nextjs";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Prefer freshness on mobile Safari / slow networks over aggressive stale shells
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  workboxOptions: {
    importScripts: ["/shadow-companion-sw.js"],
  },
});

/**
 * Capacitor / Play Store:
 * - Default (Vercel): keep API routes, middleware, Server Actions, Prisma.
 * - Do NOT set permanent `output: 'export'` — that breaks production APIs.
 * - Android WebView loads the hosted app via capacitor.config.ts → `server.url`.
 * - Optional offline shell only: `CAPACITOR_STATIC_EXPORT=1 npm run build`
 *   (then APIs must use NEXT_PUBLIC_API_URL absolute URLs).
 * - Bootstrap `out/`: `npm run cap:prepare` → `npx cap sync`.
 */
const isCapacitorStaticExport = process.env.CAPACITOR_STATIC_EXPORT === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isCapacitorStaticExport
    ? {
        output: "export",
        // Static export cannot use Next image optimizer.
      }
    : {}),
  images: { unoptimized: true },
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  // Vendored TalkingHead (Desktop/GLB/TalkingHead-main) — transpile for App Router.
  transpilePackages: ["@met4citizen/talkinghead"],
  webpack: (config) => {
    // Ensure .mjs lipsync / retargeter modules resolve from the vendored package.
    config.module.rules.push({
      test: /vendor[\\/]talkinghead[\\/]modules[\\/].*\.mjs$/,
      type: "javascript/auto",
      resolve: { fullySpecified: false },
    });
    return config;
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "buddieai.com" }],
        destination: "https://www.buddieai.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/widget/buddy-widget.css",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            // microphone=(self) required for Karen hold-to-talk STT
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

const sentryWrappedConfig = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});

export default withPWA(sentryWrappedConfig);
