import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pushScript = join(root, "scripts", "prisma-db-push.mjs");

const result = spawnSync(
  "npx",
  ["vercel", "env", "run", "-e", "production", "--", "node", pushScript],
  { stdio: "inherit", shell: true, cwd: root },
);

if (result.error) {
  console.error(result.error);
}
process.exit(result.status ?? 1);
