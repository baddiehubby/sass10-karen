import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// `db push` needs a direct connection; prefer non-pooled URLs from Vercel Storage.
if (process.env.POSTGRES_URL?.trim()) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL.trim();
} else if (process.env.PRISMA_DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = process.env.PRISMA_DATABASE_URL.trim();
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error(
    "DATABASE_URL is empty. Set DATABASE_URL or POSTGRES_URL on Vercel (Storage → Connect), then re-run: npx vercel env run -e production -- node scripts/prisma-db-push.mjs",
  );
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", "db", "push"], {
  stdio: "inherit",
  shell: true,
  cwd: root,
});

process.exit(result.status ?? 1);
