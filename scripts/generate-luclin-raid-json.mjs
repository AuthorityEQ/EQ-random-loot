import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "data", "luclin-raid-source.csv");
const outputPath = path.join(root, "data", "luclin-raid.json");

function parseCsv(raw) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const next = raw[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function clean(value) {
  return String(value ?? "").trim();
}

function isWantedBucket(value) {
  return ["1", "2", "3", "4"].includes(clean(value));
}

function cleanLoot(value) {
  const item = clean(value);
  if (!item || item === "`") return null;
  if (/^not randomed$/i.test(item)) return null;
  return item;
}

const raw = fs.readFileSync(sourcePath, "utf8");
const [header, ...rows] = parseCsv(raw);
const indexByHeader = new Map(header.map((name, index) => [clean(name), index]));
const lootIndexes = header
  .map((name, index) => (/^LOOT\s+\d+$/i.test(clean(name)) ? index : -1))
  .filter((index) => index >= 0);

const tiers = new Map();

for (const row of rows) {
  const bucket = clean(row[indexByHeader.get("Bucket")]);
  if (!isWantedBucket(bucket)) continue;

  const name = clean(row[indexByHeader.get("NPC NAME")]);
  const zone = clean(row[indexByHeader.get("ZONE")]);
  const level = Number(clean(row[indexByHeader.get("LVL")]));
  const motm = clean(row[indexByHeader.get("MOTM")]);

  if (!name || !zone || !Number.isFinite(level)) continue;

  const lootPool = lootIndexes
    .map((index) => cleanLoot(row[index]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  if (!tiers.has(bucket)) {
    tiers.set(bucket, {
      tier: Number(bucket),
      name: `Bucket ${bucket}`,
      bosses: [],
    });
  }

  tiers.get(bucket).bosses.push({
    name,
    level,
    zone,
    notes: motm ? `MOTM: ${motm}` : undefined,
    loot_pool: lootPool,
  });
}

const dataset = {
  expansion: "Luclin",
  tiers: Array.from(tiers.values()).sort((a, b) => Number(a.tier) - Number(b.tier)),
};

fs.writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      output: path.relative(root, outputPath),
      tiers: dataset.tiers.map((tier) => ({
        tier: tier.tier,
        bosses: tier.bosses.length,
        zones: new Set(tier.bosses.map((boss) => boss.zone)).size,
      })),
    },
    null,
    2,
  ),
);
