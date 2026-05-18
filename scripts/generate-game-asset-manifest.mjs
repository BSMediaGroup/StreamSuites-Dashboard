import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const supportedExtensions = new Set([".webp", ".gif", ".png", ".jpg", ".jpeg", ".bmp", ".svg"]);
const repoRoot = process.cwd();
const assetRoot = path.join(repoRoot, "docs", "assets", "games");
const outputPath = path.join(assetRoot, "asset-files.json");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(absolutePath));
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!supportedExtensions.has(extension)) continue;
    const details = await stat(absolutePath);
    const relativePath = path.relative(assetRoot, absolutePath).split(path.sep).join("/");
    files.push({
      path: `assets/games/${relativePath}`,
      filename: entry.name,
      extension: extension.slice(1),
      size_bytes: details.size
    });
  }
  return files;
}

const items = (await walk(assetRoot)).sort((a, b) => a.path.localeCompare(b.path));
const payload = {
  version: 1,
  generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  asset_root: "assets/games",
  supported_extensions: Array.from(supportedExtensions).map((extension) => extension.slice(1)).sort(),
  count: items.length,
  items
};

await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${items.length} game image assets to ${path.relative(repoRoot, outputPath)}`);
