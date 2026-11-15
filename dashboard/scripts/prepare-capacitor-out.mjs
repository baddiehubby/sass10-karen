/**
 * Writes a minimal static `out/` bootstrap for Capacitor sync.
 * The real app loads from capacitor.config.ts `server.url` (hosted Next.js).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "out");
mkdirSync(outDir, { recursive: true });

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Karen</title>
    <style>
      html, body { margin: 0; height: 100%; background: #09090b; color: #fda4af; font-family: system-ui, sans-serif; }
      main { min-height: 100%; display: grid; place-items: center; padding: 2rem; text-align: center; }
      p { opacity: 0.7; font-size: 0.9rem; }
    </style>
  </head>
  <body>
    <main>
      <div>
        <h1>Karen</h1>
        <p>Loading your accountability coach…</p>
      </div>
    </main>
  </body>
</html>
`;

writeFileSync(join(outDir, "index.html"), html, "utf8");
console.log("[cap:prepare] Wrote out/index.html bootstrap for Capacitor");
