import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const baseUrl = "https://eqmap.vercel.app";
const zoneShortName = process.argv[2] ?? "befallen";
const outputPath = resolve(process.argv[3] ?? `data/eqmap-${zoneShortName}-sample.json`);

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "frostreaver-zone-source-investigation/1.0",
    },
  });
  if (!response.ok) throw new Error(`Failed ${url}: ${response.status} ${response.statusText}`);
  return response.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

function parseRaceLookup(bundleText) {
  const match = bundleText.match(/var\s+Ay=JSON\.parse\(`([\s\S]*?)`\)/);
  if (!match) return {};
  const races = Function(`return JSON.parse(\`${match[1]}\`)`)();
  return Object.fromEntries(races.map((race) => [String(race.id), race.name]));
}

function parseClassLookup(bundleText) {
  const match = bundleText.match(/xA=\{([^}]+)\};function/);
  if (!match) return {};
  const entries = [...match[1].matchAll(/(\d+):"([^"]+)"/g)];
  return Object.fromEntries(entries.map(([, id, name]) => [id, name]));
}

function cleanSpawnName(name) {
  return (name || "Unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function main() {
  const manifest = await fetchJson(`${baseUrl}/asset-manifest.json`);
  const mainJsPath = manifest.files?.["main.js"];
  if (!mainJsPath) throw new Error("Could not find main.js in asset manifest.");

  const bundleUrl = new URL(mainJsPath, baseUrl).href;
  const [bundleText, zoneGroups] = await Promise.all([
    fetchText(bundleUrl),
    fetchJson(`${baseUrl}/zones/${zoneShortName}.json`),
  ]);

  const raceById = parseRaceLookup(bundleText);
  const classById = parseClassLookup(bundleText);
  const spawns = zoneGroups.flatMap((group, spawnGroupIndex) =>
    group.map((spawn, spawnIndex) => ({
      zoneShortName,
      spawnGroupIndex,
      spawnIndex,
      id: spawn.id ?? null,
      name: spawn.name ?? "Unknown",
      displayName: cleanSpawnName(spawn.name),
      level: spawn.level ?? null,
      raceId: spawn.race ?? null,
      race: raceById[String(spawn.race)] ?? null,
      classId: spawn.class ?? null,
      className: classById[String(spawn.class)] ?? null,
      x: spawn.x ?? null,
      y: spawn.y ?? null,
      z: spawn.z ?? null,
      heading: spawn.heading ?? null,
      chance: spawn.chance ?? null,
      spawnGroupCandidateCount: group.length,
      respawnTime: spawn.respawnTime ?? null,
      hp: spawn.hp ?? null,
      gender: spawn.gender ?? null,
      size: spawn.size ?? null,
      version: spawn.version ?? null,
      texture: spawn.texture ?? null,
    })),
  );

  const output = {
    source: {
      appUrl: baseUrl,
      assetManifestUrl: `${baseUrl}/asset-manifest.json`,
      bundleUrl,
      zoneUrl: `${baseUrl}/zones/${zoneShortName}.json`,
      note: "Static app asset investigation. Reuse/license terms were not found in the app assets.",
    },
    zoneShortName,
    spawnGroups: zoneGroups.length,
    spawnRows: spawns.length,
    fields: Object.keys(spawns[0] ?? {}),
    spawns,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${spawns.length} ${zoneShortName} spawn rows to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
