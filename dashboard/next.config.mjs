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
 * Capacitor / Play Store note:
 * Do NOT set `output: 'export'` on this app. Static export cannot include
 * `/api/*` routes, middleware, Server Actions, or Prisma — all required by Karen.
 * The Android shell loads the hosted Next.js app via `capacitor.config.ts` → `server.url`.
 * Run `npm run cap:prepare` to generate the Capacitor `out/` bootstrap folder.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // images.unoptimized is only needed for a true static export; keep default for Vercel.
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
