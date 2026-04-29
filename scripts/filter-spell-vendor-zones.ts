import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SpellVendor = {
  zone: string;
  npc: string;
  price: string;
  sourceUrl: string;
};

type SpellRecord = {
  name: string;
  vendors?: SpellVendor[];
  vendorStatus?: string;
};

const outputPath = path.join(process.cwd(), "data", "spells.json");
const excludedVendorZones = new Set([
  "Plane of Knowledge",
  "Abysmal Sea",
  "Crescent Reach",
  "Shar Vahl",
  "Shadow Haven",
  "The Mines of Gloomingdeep",
  "Katta Castellum",
]);

const spells = JSON.parse(await readFile(outputPath, "utf8")) as SpellRecord[];
let filteredVendorEntries = 0;
let spellsMarked = 0;

for (const spell of spells) {
  if (!Array.isArray(spell.vendors)) continue;

  const filtered = spell.vendors.filter((vendor) => {
    const keep = !excludedVendorZones.has(vendor.zone);
    if (!keep) filteredVendorEntries += 1;
    return keep;
  });

  if (filtered.length > 0) {
    spell.vendors = filtered;
    if (spell.vendorStatus === "no_vendor_data_found_after_filter") {
      delete spell.vendorStatus;
    }
    continue;
  }

  if (spell.vendors.length > 0) {
    delete spell.vendors;
    spell.vendorStatus = "no_vendor_data_found_after_filter";
    spellsMarked += 1;
  }
}

await writeFile(outputPath, `${JSON.stringify(spells, null, 2)}\n`);

console.log(JSON.stringify({ filteredVendorEntries, spellsMarked }, null, 2));
