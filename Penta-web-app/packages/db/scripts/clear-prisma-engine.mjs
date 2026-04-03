/**
 * Windows: prisma generate often fails with EPERM when renaming query_engine-*.dll.node
 * because Bun/Node still has the previous binary loaded. Removing the old file first
 * helps; if unlink fails, stop the dev server (and Cursor terminals running the app) then retry.
 */
import { readdir, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const generatedDir = join(__dirname, "../prisma/generated");

let removed = 0;
try {
  const files = await readdir(generatedDir);
  const targets = files.filter((f) => f.includes("query_engine"));
  for (const f of targets) {
    const p = join(generatedDir, f);
    try {
      await unlink(p);
      removed++;
    } catch (e) {
      console.warn(
        `[clear-prisma-engine] Could not remove ${f}: ${/** @type {Error} */ (e).message}`
      );
      console.warn(
        "  → Stop the API/dev server (anything using Prisma), then run: bun run db:generate"
      );
    }
  }
  if (removed > 0) {
    console.log(`[clear-prisma-engine] Removed ${removed} engine file(s) before generate.`);
  }
} catch (e) {
  if (/** @type {NodeJS.ErrnoException} */ (e).code !== "ENOENT") {
    console.warn("[clear-prisma-engine]", /** @type {Error} */ (e).message);
  }
}
