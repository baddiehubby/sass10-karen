#!/usr/bin/env node
/** Pack browser-extension zip for Chrome Web Store (no key.pem, node_modules, .git). */
import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const extRoot = join(__dirname, "..", "..", "browser-extension");
const outDir = join(__dirname, "..", "public", "downloads");
const outZip = join(outDir, "buddy-extension.zip");
const staging = join(outDir, ".extension-staging");

mkdirSync(outDir, { recursive: true });

const isWin = process.platform === "win32";
if (isWin) {
  execSync(
    `powershell -NoProfile -Command "` +
      `$s='${staging.replace(/'/g, "''")}'; $e='${extRoot.replace(/'/g, "''")}'; $z='${outZip.replace(/'/g, "''")}'; ` +
      `if (Test-Path $s) { Remove-Item -Recurse -Force $s }; New-Item -ItemType Directory -Force -Path $s | Out-Null; ` +
      `Get-ChildItem $e -Force | Where-Object { $_.Name -notin @('node_modules','.git','key.pem','dist') } | Copy-Item -Recurse -Destination $s; ` +
      `if (Test-Path $z) { Remove-Item -Force $z }; Compress-Archive -Path (Join-Path $s '*') -DestinationPath $z -Force; ` +
      `Remove-Item -Recurse -Force $s"`,
    { stdio: "inherit" },
  );
} else {
  execSync(`cd "${extRoot}" && zip -r "${outZip}" . -x "node_modules/*" -x ".git/*" -x "key.pem" -x "dist/*"`, {
    stdio: "inherit",
  });
}

if (!existsSync(outZip)) {
  console.error("Failed to create", outZip);
  process.exit(1);
}
console.log("Created", outZip);
