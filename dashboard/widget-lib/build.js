const fs = require("fs");
const path = require("path");
const { build } = require("esbuild");

const libRoot = __dirname;
const entry = path.join(libRoot, "src", "widget.js");
const outdir = path.join(libRoot, "dist");
const outfile = path.join(outdir, "livingface-widget.js");

fs.mkdirSync(outdir, { recursive: true });

build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2017",
  legalComments: "none",
})
  .then(() => {
    const bytes = fs.statSync(outfile).size;
    const kb = (bytes / 1024).toFixed(1);
    console.log(`[widget] ${path.relative(libRoot, outfile)}  ${bytes} bytes (${kb} KB raw). Target gzip CDN typically ~40–55% of raw.`);
    const cssSrc = path.join(libRoot, "src", "buddy-widget.css");
    const cssDest = path.join(outdir, "buddy-widget.css");
    if (fs.existsSync(cssSrc)) {
      fs.copyFileSync(cssSrc, cssDest);
      console.log(`[widget] ${path.relative(libRoot, cssDest)} copied for distribution.`);
    }
    if (bytes > 50 * 1024) {
      console.warn("[widget] Raw bundle exceeds 50KB; consider trimming features or raising CDN gzip threshold.");
    }
  })
  .catch(() => process.exit(1));
