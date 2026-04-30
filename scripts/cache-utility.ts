/**
 * cache-utility.ts
 *
 * Manages the pipeline's disk caches.  All cache directories are tracked in
 * cache/manifest.json so that operators have a single place to inspect what
 * has been cached and when.
 *
 * Usage:
 *   node --experimental-strip-types scripts/cache-utility.ts --list
 *   node --experimental-strip-types scripts/cache-utility.ts --prune --older-than=30
 *   node --experimental-strip-types scripts/cache-utility.ts --invalidate <slug>
 *   node --experimental-strip-types scripts/cache-utility.ts --rebuild-manifest
 */

import { existsSync } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ManifestEntry = {
  /** SHA-1 slug (filename without extension) */
  slug: string;
  /** Cache subdirectory key (e.g. "zam-pages") */
  cache: string;
  /** ISO timestamp when the file was first downloaded */
  downloadedAt: string;
  /** File size in bytes at time of manifest write */
  sizeBytes: number;
  /** Optional human-readable label (e.g. "search:Ancient Wyvern") */
  label?: string;
};

type CacheManifest = {
  version: 1;
  updatedAt: string;
  entries: ManifestEntry[];
};

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const root = process.cwd();
const cacheRoot = path.join(root, "cache");
const manifestPath = path.join(cacheRoot, "manifest.json");

/**
 * All known cache sub-directories.  Add new ones here as the pipeline grows.
 */
const KNOWN_CACHE_DIRS: Record<string, string> = {
  "zam-pages": "Allakhazam item/search HTML pages",
  "zam-zones": "Allakhazam zone pages (optional enrichment)",
  "zam-npcs": "Allakhazam NPC pages (optional enrichment)",
  "eqprogression": "EQ Progression wiki pages",
};

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

function log(msg: string) {
  process.stdout.write(msg + "\n");
}

// ---------------------------------------------------------------------------
// Manifest helpers
// ---------------------------------------------------------------------------

async function loadManifest(): Promise<CacheManifest> {
  if (!existsSync(manifestPath)) {
    return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
  }
  return JSON.parse(await readFile(manifestPath, "utf8")) as CacheManifest;
}

async function saveManifest(manifest: CacheManifest) {
  await mkdir(cacheRoot, { recursive: true });
  manifest.updatedAt = new Date().toISOString();
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

async function rebuildManifest(): Promise<CacheManifest> {
  const manifest = await loadManifest();
  const bySlug = new Map<string, ManifestEntry>(
    manifest.entries.map((e) => [e.slug, e]),
  );

  for (const [cacheName] of Object.entries(KNOWN_CACHE_DIRS)) {
    const dirPath = path.join(cacheRoot, cacheName);
    if (!existsSync(dirPath)) continue;

    const files = await readdir(dirPath);
    for (const file of files) {
      if (!file.endsWith(".html") && !file.endsWith(".json")) continue;
      const slug = file.replace(/\.[^.]+$/, "");
      if (bySlug.has(slug)) continue; // already tracked

      const filePath = path.join(dirPath, file);
      const info = await stat(filePath);
      bySlug.set(slug, {
        slug,
        cache: cacheName,
        downloadedAt: info.birthtime.toISOString(),
        sizeBytes: info.size,
      });
    }
  }

  manifest.entries = Array.from(bySlug.values()).sort((a, b) => a.slug.localeCompare(b.slug));
  await saveManifest(manifest);
  return manifest;
}

// ---------------------------------------------------------------------------
// --list
// ---------------------------------------------------------------------------

async function listCaches() {
  log(`\n${BOLD}Cache Directory Report${RESET}`);
  log(`Cache root: ${DIM}${cacheRoot}${RESET}\n`);

  let grandTotalBytes = 0;
  let grandTotalFiles = 0;

  for (const [cacheName, description] of Object.entries(KNOWN_CACHE_DIRS)) {
    const dirPath = path.join(cacheRoot, cacheName);

    if (!existsSync(dirPath)) {
      log(`  ${YELLOW}${cacheName.padEnd(20)}${RESET}  ${DIM}(not created)${RESET}   ${description}`);
      continue;
    }

    const files = await readdir(dirPath);
    let totalBytes = 0;

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const info = await stat(filePath);
      totalBytes += info.size;
    }

    grandTotalBytes += totalBytes;
    grandTotalFiles += files.length;

    log(
      `  ${GREEN}${cacheName.padEnd(20)}${RESET}  ${String(files.length).padStart(5)} files  ${formatBytes(totalBytes).padStart(10)}  ${DIM}${description}${RESET}`,
    );
  }

  log(`\n${"─".repeat(64)}`);
  log(`  ${"TOTAL".padEnd(20)}  ${String(grandTotalFiles).padStart(5)} files  ${formatBytes(grandTotalBytes).padStart(10)}`);

  // Manifest status
  if (existsSync(manifestPath)) {
    const manifest = await loadManifest();
    log(`\nManifest: ${manifest.entries.length} tracked entries, last updated ${manifest.updatedAt}`);
  } else {
    log(`\n${YELLOW}Manifest not found.${RESET} Run --rebuild-manifest to create it.`);
  }

  log("");
}

// ---------------------------------------------------------------------------
// --prune --older-than=N
// ---------------------------------------------------------------------------

async function pruneCache(olderThanDays: number, dryRun: boolean) {
  const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(cutoffMs);

  log(`\n${BOLD}Cache Prune${RESET}`);
  log(`Removing files not accessed since ${cutoffDate.toISOString()}${dryRun ? " [DRY RUN]" : ""}\n`);

  let removedCount = 0;
  let removedBytes = 0;

  const manifest = await loadManifest();
  const slugsToRemove = new Set<string>();

  for (const [cacheName] of Object.entries(KNOWN_CACHE_DIRS)) {
    const dirPath = path.join(cacheRoot, cacheName);
    if (!existsSync(dirPath)) continue;

    const files = await readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const info = await stat(filePath);

      // Use mtime (last access/modification) for pruning threshold
      if (info.mtimeMs < cutoffMs) {
        const sizeBytes = info.size;
        log(`  ${RED}remove${RESET}  ${cacheName}/${file}  ${DIM}(${formatBytes(sizeBytes)}, last modified ${info.mtime.toISOString()})${RESET}`);

        if (!dryRun) {
          await rm(filePath);
        }

        removedCount++;
        removedBytes += sizeBytes;
        const slug = file.replace(/\.[^.]+$/, "");
        slugsToRemove.add(slug);
      }
    }
  }

  if (!dryRun && slugsToRemove.size > 0) {
    manifest.entries = manifest.entries.filter((e) => !slugsToRemove.has(e.slug));
    await saveManifest(manifest);
    log(`\nUpdated manifest: removed ${slugsToRemove.size} entries.`);
  }

  log(`\n${"─".repeat(64)}`);
  if (dryRun) {
    log(`[dry-run] Would remove ${removedCount} file(s) totalling ${formatBytes(removedBytes)}`);
  } else {
    log(`Removed ${removedCount} file(s) totalling ${formatBytes(removedBytes)}`);
  }
  log("");
}

// ---------------------------------------------------------------------------
// --invalidate <slug>
// ---------------------------------------------------------------------------

async function invalidateSlug(slug: string) {
  log(`\n${BOLD}Cache Invalidation${RESET}`);
  log(`Target slug: ${CYAN}${slug}${RESET}\n`);

  let found = 0;
  const manifest = await loadManifest();

  for (const [cacheName] of Object.entries(KNOWN_CACHE_DIRS)) {
    const dirPath = path.join(cacheRoot, cacheName);
    if (!existsSync(dirPath)) continue;

    const files = await readdir(dirPath);
    for (const file of files) {
      const fileSlug = file.replace(/\.[^.]+$/, "");
      if (fileSlug !== slug) continue;

      const filePath = path.join(dirPath, file);
      log(`  Removing ${GREEN}${cacheName}/${file}${RESET}`);
      await rm(filePath);
      found++;
    }
  }

  if (found === 0) {
    log(`  ${YELLOW}No files found matching slug "${slug}"${RESET}`);
  } else {
    manifest.entries = manifest.entries.filter((e) => e.slug !== slug);
    await saveManifest(manifest);
    log(`\nRemoved ${found} file(s). Manifest updated.`);
  }
  log("");
}

// ---------------------------------------------------------------------------
// --rebuild-manifest
// ---------------------------------------------------------------------------

async function doRebuildManifest() {
  log(`\n${BOLD}Rebuilding Cache Manifest${RESET}\n`);
  const manifest = await rebuildManifest();
  log(`${GREEN}Done.${RESET} Tracked ${manifest.entries.length} cache entries.`);
  log(`Manifest written to: ${DIM}${manifestPath}${RESET}\n`);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return { action: "help" as const };
  }

  if (args.includes("--list")) {
    return { action: "list" as const };
  }

  if (args.includes("--rebuild-manifest")) {
    return { action: "rebuild-manifest" as const };
  }

  if (args.includes("--prune")) {
    const olderThanArg = args.find((a) => a.startsWith("--older-than="));
    const dryRun = args.includes("--dry-run");
    if (!olderThanArg) {
      throw new Error("--prune requires --older-than=<days>");
    }
    const days = Number(olderThanArg.split("=")[1]);
    if (!Number.isFinite(days) || days < 1) {
      throw new Error(`--older-than must be a positive integer (days), got: ${olderThanArg.split("=")[1]}`);
    }
    return { action: "prune" as const, days, dryRun };
  }

  if (args.includes("--invalidate")) {
    const idx = args.indexOf("--invalidate");
    const slug = args[idx + 1];
    if (!slug || slug.startsWith("--")) {
      throw new Error("--invalidate requires a slug argument");
    }
    return { action: "invalidate" as const, slug };
  }

  throw new Error(`Unknown arguments: ${args.join(" ")}`);
}

function printHelp() {
  log([
    "",
    "Usage: node --experimental-strip-types scripts/cache-utility.ts <command>",
    "",
    "Commands:",
    "  --list                      Show cache directory sizes and manifest status",
    "  --prune --older-than=<N>    Remove cache files not modified in N days",
    "    [--dry-run]               Print files that would be removed without deleting",
    "  --invalidate <slug>         Remove a specific cache file by SHA-1 slug",
    "  --rebuild-manifest          Scan all cache dirs and regenerate manifest.json",
    "  --help, -h                  Show this help",
    "",
    "Cache manifest:",
    `  ${manifestPath}`,
    "",
    "Known cache directories:",
    ...Object.entries(KNOWN_CACHE_DIRS).map(([k, v]) => `  cache/${k.padEnd(20)} ${v}`),
    "",
  ].join("\n"));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs(process.argv);
  } catch (err) {
    log(`${RED}Error:${RESET} ${err instanceof Error ? err.message : String(err)}`);
    printHelp();
    process.exit(1);
  }

  switch (parsed.action) {
    case "help":
      printHelp();
      break;

    case "list":
      await listCaches();
      break;

    case "prune":
      await pruneCache(parsed.days, parsed.dryRun ?? false);
      break;

    case "invalidate":
      await invalidateSlug(parsed.slug);
      break;

    case "rebuild-manifest":
      await doRebuildManifest();
      break;
  }
}

await main();
