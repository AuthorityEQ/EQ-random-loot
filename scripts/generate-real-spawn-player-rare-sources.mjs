import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");

function normalizeName(value) {
  return String(value ?? "")
    .replace(/^#+/, "")
    .replace(/_/g, " ")
    .replace(/`/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeTargetName(value) {
  return normalizeName(value).replace(/^(a|an|the)\s+/, "");
}

function addMobSource(map, name, source) {
  const key = normalizeTargetName(name);
  if (!key) return;
  const current = map.get(key) ?? {
    displayName: String(name ?? "").trim(),
    epicClasses: new Set(),
    epicItems: new Set(),
    groupLootExpansions: new Set(),
    groupLootItems: new Set(),
    sourceKinds: new Set(),
    zones: new Set(),
  };
  if (source.displayName && current.displayName.length < source.displayName.length) current.displayName = source.displayName;
  if (source.epicClass) current.epicClasses.add(source.epicClass);
  for (const item of source.epicItems ?? []) current.epicItems.add(item);
  if (source.groupLootExpansion) current.groupLootExpansions.add(source.groupLootExpansion);
  for (const item of source.groupLootItems ?? []) current.groupLootItems.add(item);
  if (source.kind) current.sourceKinds.add(source.kind);
  if (source.zone) current.zones.add(source.zone);
  map.set(key, current);
}

const mobSources = new Map();
const epicItemNames = new Set();
const epicDropItemNames = new Set();

for (const file of ["classic-group-named.json", "kunark-group-named.json", "velious-group-named.json"]) {
  const datasetPath = path.join(dataDir, file);
  if (!fs.existsSync(datasetPath)) continue;
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
  const expansion = dataset.metadata?.expansion ?? file.replace("-group-named.json", "");
  for (const bucket of dataset.buckets ?? []) {
    for (const mob of bucket.mobs ?? []) {
      addMobSource(mobSources, mob.name, {
        displayName: mob.name,
        groupLootExpansion: mob.expansion ?? expansion,
        groupLootItems: mob.loot ?? [],
        kind: "group-named-loot",
        zone: mob.zone,
      });
    }
  }
}

const epicPath = path.join(dataDir, "excel-imports", "epic-quests.json");
if (fs.existsSync(epicPath)) {
  const epicData = JSON.parse(fs.readFileSync(epicPath, "utf8"));
  for (const cls of epicData.classes ?? []) {
    const className = cls.class_name ?? cls.className ?? cls.name ?? "Unknown";
    for (const step of cls.steps ?? []) {
      const stepItems = [
        ...(Array.isArray(step.drop_items) ? step.drop_items.map((item) => item?.name).filter(Boolean) : []),
        ...(Array.isArray(step.turn_in_items) ? step.turn_in_items.map((item) => item?.name).filter(Boolean) : []),
        ...(Array.isArray(step.reward_items) ? step.reward_items.map((item) => item?.name).filter(Boolean) : []),
      ];
      for (const item of stepItems) epicItemNames.add(normalizeTargetName(item));
      for (const item of Array.isArray(step.drop_items) ? step.drop_items.map((drop) => drop?.name).filter(Boolean) : []) {
        epicDropItemNames.add(normalizeTargetName(item));
      }
      if (step.npc_mob) {
        addMobSource(mobSources, step.npc_mob, {
          displayName: step.npc_mob,
          epicClass: className,
          epicItems: stepItems,
          kind: "epic-source-mob",
          zone: step.zone,
        });
      }
    }
  }
}

const epicNamesPath = path.join(dataDir, "epic-item-names.json");
if (fs.existsSync(epicNamesPath)) {
  for (const item of JSON.parse(fs.readFileSync(epicNamesPath, "utf8"))) {
    epicItemNames.add(normalizeTargetName(item));
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  sourceFiles: [
    "data/classic-group-named.json",
    "data/kunark-group-named.json",
    "data/velious-group-named.json",
    "data/excel-imports/epic-quests.json",
    "data/epic-item-names.json",
  ],
  mobSources: Object.fromEntries([...mobSources.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, {
    displayName: value.displayName,
    epicClasses: [...value.epicClasses].sort(),
    epicItems: [...value.epicItems].sort(),
    groupLootExpansions: [...value.groupLootExpansions].sort(),
    groupLootItems: [...value.groupLootItems].sort(),
    sourceKinds: [...value.sourceKinds].sort(),
    zones: [...value.zones].sort(),
  }])),
  epicItemNames: [...epicItemNames].filter(Boolean).sort(),
  epicDropItemNames: [...epicDropItemNames].filter(Boolean).sort(),
};

fs.writeFileSync(path.join(dataDir, "real-spawn-player-rare-sources.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({
  mobSources: Object.keys(output.mobSources).length,
  epicDropItemNames: output.epicDropItemNames.length,
  epicItemNames: output.epicItemNames.length,
  iksarBetrayer: output.mobSources["iksar betrayer"] ?? null,
}, null, 2));
