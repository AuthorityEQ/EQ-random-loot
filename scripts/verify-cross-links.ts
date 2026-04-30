/** scripts/verify-cross-links.ts
 * Cross-link verification for EQ-random-loot.
 * Run from repo root: npx tsx scripts/verify-cross-links.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Mob { name: string; level: number; zone: string; expansion: string; }
interface Bucket { bucket: number; expansion: string; level_range: string; zones: string[]; mobs: Mob[]; loot_pool: string[]; }
interface LootDataset { buckets: Bucket[]; }
interface RaidBoss { name: string; level: number; zone: string; loot_pool?: string[]; }
interface RaidTier { name: string; bosses: RaidBoss[]; }
interface RaidDataset { expansion: string; tiers: RaidTier[]; }

function mobToSlug(n:string):string{return n.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");}
function zoneToSlug(n:string):string{return n.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
// itemToSlug: strips apostrophes BEFORE normalising (unique to lib/item-slug.ts)
function itemToSlug(n:string):string{return n.toLowerCase().replace(/['‘’`]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
// inlineItemSlug: used by lib/crafting.ts and EpicTrackerClient -- NO apostrophe strip
function inlineItemSlug(n:string):string{return n.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}

interface MobRecord { name: string; slug: string; zone: string; expansion: string; }

function buildMobIndex(groupBuckets: Bucket[], raidDatasets: RaidDataset[]): Map<string, MobRecord> {
  type R = { name: string; level: number; zone: string; expansion: string };
  const raw: R[] = [];
  for (const b of groupBuckets) for (const m of b.mobs) raw.push({ name: m.name, level: m.level, zone: m.zone, expansion: m.expansion });
  for (const d of raidDatasets) for (const t of d.tiers) for (const bo of t.bosses) raw.push({ name: bo.name, level: bo.level, zone: bo.zone, expansion: d.expansion });
  const cnt = new Map<string, number>();
  for (const e of raw) { const b = mobToSlug(e.name); cnt.set(b, (cnt.get(b) ?? 0) + 1); }
  const used = new Set<string>(); const idx = new Map<string, MobRecord>();
  for (const e of raw) {
    const base = mobToSlug(e.name); let slug = base;
    if ((cnt.get(base) ?? 0) > 1 || used.has(base)) slug = base + "--" + mobToSlug(e.zone);
    if (used.has(slug)) slug = slug + "--" + e.level;
    used.add(slug); idx.set(slug, { name: e.name, slug, zone: e.zone, expansion: e.expansion });
  }
  return idx;
}

function buildItemSlugMap(items: Record<string, unknown>) {
  const s2n = new Map<string, string>(); const n2s = new Map<string, string>();
  for (const name of Object.keys(items)) {
    const base = itemToSlug(name);
    if (!s2n.has(base)) { s2n.set(base, name); n2s.set(name, base); }
    else { let sf = 2; let c = base + "-" + sf; while (s2n.has(c)) { sf++; c = base + "-" + sf; } s2n.set(c, name); n2s.set(name, c); }
  }
  return { slugToName: s2n, nameToSlug: n2s };
}

interface Link { file: string; line: number; type: "zone" | "mob" | "item"; slug: string; }

function findTsFiles(dir: string): string[] {
  const out: string[] = [];
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".next", "scripts"].includes(e.name)) continue;
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...findTsFiles(fp));
      else if (e.name.endsWith(".tsx") || (e.name.endsWith(".ts") && !e.name.endsWith(".d.ts"))) out.push(fp);
    }
  } catch {}
  return out;
}

function extractLinks(filePath: string, root: string): Link[] {
  const src = fs.readFileSync(filePath, "utf-8");
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  const out: Link[] = [];
  const TYPES: Array<"zone" | "mob" | "item"> = ["zone", "mob", "item"];
  for (const type of TYPES) {
    const pattern = "/" + type + "/";
    let idx2 = 0;
    while (true) {
      const pos = src.indexOf(pattern, idx2);
      if (pos === -1) break;
      idx2 = pos + 1;
      let i = pos + pattern.length; let slug = "";
      while (i < src.length && /[a-z0-9-]/.test(src[i])) { slug += src[i]; i++; }
      if (slug.length === 0) continue;
      const lineNum = src.slice(0, pos).split("\n").length;
      out.push({ file: rel, line: lineNum, type, slug });
    }
  }
  return out;
}

interface Collision { base: string; entries: Array<{ name: string; zone: string; finalSlug: string }> }

function detectMobCollisions(gb: Bucket[], rd: RaidDataset[]): Collision[] {
  type R = { name: string; zone: string; level: number };
  const raw: R[] = [];
  for (const b of gb) for (const m of b.mobs) raw.push({ name: m.name, zone: m.zone, level: m.level });
  for (const d of rd) for (const t of d.tiers) for (const bo of t.bosses) raw.push({ name: bo.name, zone: bo.zone, level: bo.level });
  const cnt = new Map<string, number>();
  for (const e of raw) { const b = mobToSlug(e.name); cnt.set(b, (cnt.get(b) ?? 0) + 1); }
  const cm = new Map<string, R[]>();
  for (const e of raw) { const b = mobToSlug(e.name); if ((cnt.get(b) ?? 0) > 1) { const ex = cm.get(b) ?? []; ex.push(e); cm.set(b, ex); } }
  const idx = buildMobIndex(gb, rd); const res: Collision[] = [];
  for (const [base, entries] of cm) {
    const resolved = entries.map((e) => { let fs2 = base; for (const [sl, rec] of idx) { if (rec.name === e.name && rec.zone === e.zone) { fs2 = sl; break; } } return { name: e.name, zone: e.zone, finalSlug: fs2 }; });
    res.push({ base, entries: resolved });
  }
  return res;
}

function detectItemCollisions(items: Record<string, unknown>) {
  const bc = new Map<string, string[]>();
  for (const n of Object.keys(items)) { const b = itemToSlug(n); const ex = bc.get(b) ?? []; ex.push(n); bc.set(b, ex); }
  const { nameToSlug } = buildItemSlugMap(items);
  return [...bc.entries()].filter(([,ns])=>ns.length>1).map(([base,names])=>({ base, names, finalSlugs: names.map((n)=>nameToSlug.get(n)??base) }));
}

function detectSlugDivergence(names: string[]) {
  return names.map((n)=>({ name:n, canonical:itemToSlug(n), inline:inlineItemSlug(n) })).filter((r)=>r.canonical!==r.inline);
}

function detectMobPageItemBug(names: string[]) {
  return names.map((n)=>({ item:n, viaMob:mobToSlug(n), correct:itemToSlug(n) })).filter((r)=>r.viaMob!==r.correct);
}

function validateZoneConnections(knownZones: Set<string>) {
  const raw = fs.readFileSync(path.resolve(__dirname, "../lib/zone-connections.ts"), "utf-8");
  const cmap = new Map<string, string[]>();
  const re2 = /"([^"]+)":\s*\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re2.exec(raw)) !== null) {
    const key = m[1]; const vals = [...m[2].matchAll(/"([^"]+)"/g)].map((x)=>x[1]); cmap.set(key, vals);
  }
  const issues: Array<{ zone: string; connectedTo: string; issue: string }> = [];
  for (const [zone, conns] of cmap) {
    if (!knownZones.has(zone)) issues.push({ zone, connectedTo: "", issue: "zone_not_in_data" });
    for (const conn of conns) {
      if (!knownZones.has(conn)) issues.push({ zone, connectedTo: conn, issue: "connected_zone_not_in_data" });
      const rev = cmap.get(conn);
      if (knownZones.has(conn) && (!rev || !rev.includes(zone))) issues.push({ zone, connectedTo: conn, issue: "missing_reverse" });
    }
  }
  return issues;
}

function main(): number {
  const ROOT = path.resolve(__dirname, "..");
  const lj = <T>(p: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf-8")) as T;
  const classic = lj<LootDataset>("data/classic-group-named.json");
  const kunark  = lj<LootDataset>("data/kunark-group-named.json");
  const velious = lj<LootDataset>("data/velious-group-named.json");
  const cr = lj<RaidDataset>("data/classic-raid.json");
  const kr = lj<RaidDataset>("data/kunark-raid.json");
  const vr = lj<RaidDataset>("data/velious-raid.json");
  const itemDetails = lj<Record<string, unknown>>("data/item-details.json");
  const buckets = [...classic.buckets, ...kunark.buckets, ...velious.buckets];
  const raids = [cr, kr, vr];
  const bosses = raids.flatMap((d) => d.tiers.flatMap((t) => t.bosses));
  const mobIdx = buildMobIndex(buckets, raids);
  const { slugToName: iSlugMap } = buildItemSlugMap(itemDetails);
  const knownZones = new Set(buckets.flatMap((b) => b.zones));
  const knownZoneSlugs = new Set([...knownZones].map(zoneToSlug));
  const tsFiles = findTsFiles(ROOT).filter((f) => !f.includes("node_modules") && !f.includes(".next"));
  const allLinks: Link[] = []; for (const f of tsFiles) allLinks.push(...extractLinks(f, ROOT));
  const zLinks = allLinks.filter((l) => l.type === "zone");
  const mLinks = allLinks.filter((l) => l.type === "mob");
  const iLinks = allLinks.filter((l) => l.type === "item");
  const deadZ = zLinks.filter((l) => !knownZoneSlugs.has(l.slug));
  const deadM = mLinks.filter((l) => !mobIdx.has(l.slug));
  const deadI = iLinks.filter((l) => !iSlugMap.has(l.slug));
  const mColl = detectMobCollisions(buckets, raids);
  const iColl = detectItemCollisions(itemDetails);
  const iDiv  = detectSlugDivergence(Object.keys(itemDetails));
  const mBug  = detectMobPageItemBug(Object.keys(itemDetails));
  const zCI   = validateZoneConnections(knownZones);
  const zDat  = zCI.filter((i) => i.issue !== "missing_reverse");
  const zRev  = zCI.filter((i) => i.issue === "missing_reverse");
  const SEP = "=".repeat(72); const SUB = "-".repeat(60); const say = console.log;
  say(""); say(SEP); say("  EQ-RANDOM-LOOT CROSS-LINK AUDIT"); say(SEP); say("");
  say("DATA SUMMARY"); say(SUB);
  say("  Total mob slugs (group + raid): " + mobIdx.size);
  say("  Group buckets:                  " + buckets.length);
  say("  Raid bosses:                    " + bosses.length);
  say("  Unique zones (from bucket.zones): " + knownZones.size);
  say("  Items in item-details.json:     " + Object.keys(itemDetails).length);
  say("");
  say("SLUG FUNCTION COMPARISON"); say(SUB);
  const fnLines = [
    "  mobToSlug  (lib/mob-slug.ts):          lower -> [^a-z0-9]+->- -> /-+/->- -> strip ends",
    "  zoneToSlug (lib/zone-slug.ts):         trim -> lower -> [^a-z0-9]+->- -> strip ends",
    "  itemToSlug (lib/item-slug.ts):         lower -> STRIP APOSTROPHES -> [^a-z0-9]+->- -> strip ends  [CANONICAL]",
    "  itemSlug   (lib/crafting.ts):          lower -> [^a-z0-9]+->- -> strip ends  [NO apostrophe strip]",
    "  mobSlug    (app/factions/page.tsx):    lower -> [^a-z0-9]+->- -> strip ends  [= zoneToSlug minus .trim()]",
    "  zoneSlug   (app/factions/page.tsx):    lower -> [^a-z0-9]+->- -> strip ends  [= zoneToSlug minus .trim()]",
    "  toUrlSlug  (EpicTrackerClient.tsx):    lower -> [^a-z0-9]+->- -> strip ends  [NO apostrophe strip]",
  ];
  for (const l of fnLines) say(l);
  say("");
  say("  KEY DIFFERENCES:");
  say("  1. itemToSlug strips apostrophes/smart-quotes BEFORE normalizing; inline clones do not.");
  say("     Apostrophes in inline clones become hyphens -- producing different slugs for items");
  say("     with apostrophe names (e.g. Tolans Darkwood Fists vs tolan-s-darkwood-fists).");
  say("  2. mobToSlug has explicit /-+/ collapse pass; others collapse via [^a-z0-9]+. Equivalent.");
  say("  3. zoneToSlug adds .trim(); inline clones skip it. No practical impact.");
  say("  4. app/mob/[name]/page.tsx line ~189 uses mobToSlug() for /item/ hrefs -- should use itemToSlug().");
  say("");
  if (iDiv.length > 0) {
    say("  APOSTROPHE DIVERGENCE: " + iDiv.length + " item(s) produce different slugs:");
    for (const d of iDiv.slice(0, 20)) { say("    Name:      " + d.name); say("      canonical: " + d.canonical); say("      inline:    " + d.inline); }
    if (iDiv.length > 20) say("    ... and " + (iDiv.length - 20) + " more");
  } else { say("  Apostrophe divergence: none in current dataset."); }
  say("");
  if (mBug.length > 0) {
    say("  MOB PAGE ITEM SLUG BUG: " + mBug.length + " item(s) get wrong /item/ slug from mob page loot list:");
    for (const d of mBug.slice(0, 15)) { say("    Item:             " + d.item); say("      mobToSlug (wrong):  " + d.viaMob); say("      itemToSlug (correct): " + d.correct); }
    if (mBug.length > 15) say("    ... and " + (mBug.length - 15) + " more");
  } else { say("  Mob page item slug divergence: none."); }
  say("");
  say("STATIC LINK SCAN"); say(SUB);
  say("  Static /zone/... hrefs found: " + zLinks.length);
  say("  Static /mob/...  hrefs found: " + mLinks.length);
  say("  Static /item/... hrefs found: " + iLinks.length);
  say("  Dynamic template hrefs (href={}) are EXCLUDED -- validated by generateStaticParams.");
  say("");
  say("DEAD LINK REPORT"); say(SUB);
  const pr = (label: string, links: Link[]) => {
    if (links.length === 0) say("  [OK] " + label + ": no dead links");
    else { say("  [!!] " + label + ": " + links.length + " dead link(s)"); for (const l of links) say("       " + l.file + ":" + l.line + "  ->  /" + l.type + "/" + l.slug); }
  };
  pr("Zone links (/zone/[slug])", deadZ);
  pr("Mob links  (/mob/[slug])",  deadM);
  pr("Item links (/item/[slug])", deadI);
  say("");
  say("SLUG COLLISION REPORT"); say(SUB);
  if (mColl.length === 0) say("  Mob collisions: none");
  else {
    say("  Mob base-slug collisions: " + mColl.length);
    for (const c of mColl) { say("    Base: " + c.base); for (const e of c.entries) say("      " + e.name + " (" + e.zone + ") -> " + e.finalSlug); }
  }
  say("");
  if (iColl.length === 0) say("  Item collisions: none");
  else {
    say("  Item base-slug collisions: " + iColl.length);
    for (const c of iColl) { say("    Base: " + c.base); for (let i = 0; i < c.names.length; i++) say("      " + c.names[i] + " -> " + c.finalSlugs[i]); }
  }
  say("");
  say("ZONE CONNECTION VALIDATION"); say(SUB);
  if (zDat.length === 0) say("  All zone connection entries reference valid zones in data.");
  else { say("  Zone connection data issues: " + zDat.length); for (const i of zDat) say("    " + i.zone + " -> " + i.connectedTo + ": " + i.issue); }
  if (zRev.length === 0) say("  All zone connections are bidirectional.");
  else { say("  Non-bidirectional connections: " + zRev.length); for (const i of zRev) say("    " + i.zone + " -> " + i.connectedTo + " (no reverse entry)"); }
  say("");
  say("SUMMARY"); say(SEP);
  const td = deadZ.length + deadM.length + deadI.length;
  say("  DEAD LINKS:       " + (td === 0 ? "NONE - all static hrefs verified clean" : td + " found"));
  say("  MOB COLLISIONS:   " + mColl.length + " (resolved with --zone suffix)");
  say("  ITEM COLLISIONS:  " + iColl.length + " (resolved with -N numeric suffix)");
  say("  SLUG DIVERGENCE:  " + iDiv.length + " items diverge between itemToSlug and inline slug fns");
  say("  MOB PAGE BUG:     " + mBug.length + " items get wrong /item/ slug on mob page");
  say("  ZONE CONN ISSUES: " + zCI.length + " (" + zRev.length + " missing reverse entries)");
  say(SEP); say("");
  return td;
}

const exitCode = main();
process.exit(exitCode > 0 ? 1 : 0);
