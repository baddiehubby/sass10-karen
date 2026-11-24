import fs from "node:fs";
import path from "node:path";
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

// @ducanh2912/next-pwa can overwrite app-paths-manifest.json with a tiny
// subset during its extra server compile. Rebuild from emitted page/route JS.
function rebuildAppPathsManifest(serverOutDir) {
  const appDir = path.join(serverOutDir, "app");
  if (!fs.existsSync(appDir)) return 0;

  /** @type {Record<string, string>} */
  const manifest = {};

  /** @param {string} dir @param {string} rel */
  function walk(dir, rel) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      const nextRel = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        walk(full, nextRel);
        continue;
      }
      if (ent.name !== "page.js" && ent.name !== "route.js") continue;
      const routeKey = `/${nextRel.replace(/\.js$/, "")}`;
      manifest[routeKey] = `app/${nextRel}`;
    }
  }

  walk(appDir, "");
  const outFile = path.join(serverOutDir, "app-paths-manifest.json");
  fs.writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return Object.keys(manifest).length;
}

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
  // On Vercel Root Directory=`dashboard`, `file:vendor/talkinghead` lands in node_modules.
  transpilePackages: ["@met4citizen/talkinghead", "@pixiv/three-vrm"],
  webpack: (config, { isServer, dev }) => {
    // TalkingHead ships ESM `.mjs` — treat as auto JS (scoped to the vendored package;
    // a blanket /node_modules/ rule can break other ESM packages / flight chunks).
    config.module.rules.push({
      test: /\.mjs$/,
      include: [
        /node_modules[\\/]@met4citizen[\\/]talkinghead/,
        /vendor[\\/]talkinghead/,
      ],
      type: "javascript/auto",
      resolve: { fullySpecified: false },
    });

    if (isServer && !dev) {
      config.plugins.push({
        apply(compiler) {
          compiler.hooks.afterEmit.tap("FixPwaServerEmit", (compilation) => {
            try {
              const out = compilation.outputOptions?.path;
              if (!out) return;

              // PWA/Sentry can leave shared chunks only under chunks/ while
              // webpack-runtime require()'s `./${id}.js` from the server root.
              const chunksDir = path.join(out, "chunks");
              if (fs.existsSync(chunksDir)) {
                let mirrored = 0;
                for (const name of fs.readdirSync(chunksDir)) {
                  if (!/^\d+\.js$/.test(name)) continue;
                  const dest = path.join(out, name);
                  if (!fs.existsSync(dest)) {
                    fs.copyFileSync(path.join(chunksDir, name), dest);
                    mirrored += 1;
                  }
                }
                if (mirrored > 0) {
                  console.log(`[next.config] mirrored ${mirrored} server chunks to output root`);
                }
              }

              const count = rebuildAppPathsManifest(out);
              if (count > 0) {
                console.log(`[next.config] rebuilt app-paths-manifest.json (${count} entries)`);
              }
            } catch (err) {
              console.warn("[next.config] FixPwaServerEmit failed:", err?.message || err);
            }
          });
        },
      });
    }

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
