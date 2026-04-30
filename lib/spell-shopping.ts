export type SpellVendor = {
  zone: string;
  npc: string;
  price: string;
  sourceUrl: string;
};

export type ShoppingListSpell = {
  name: string;
  level: number;
  class: string;
  expansion: string;
  description: string;
  sourceUrl?: string;
  vendors?: SpellVendor[];
};

export type VendorRouteSpell = {
  key: string;
  name: string;
  level: number;
  class: string;
  expansion: string;
  price: string;
};

const excludedVendorNames = new Set([
  "Ealyson Roloius",
  "Eywen Nalous",
  "Palunrion Shyeitia",
  "Quanan Mahius",
  "Quelolista Samautia",
]);
const excludedVendorZones = new Set([
  "Divided (NoS)",
  "Shar Vahl",
  "Shar Vahl, Divided (NoS)",
  "The Bazaar",
  "The Rathe Mountains",
]);

function isIncludedVendor(vendor: SpellVendor) {
  return !excludedVendorNames.has(vendor.npc) && !excludedVendorZones.has(vendor.zone);
}

export function spellShoppingKey(spell: Pick<ShoppingListSpell, "name" | "class" | "expansion" | "level">) {
  return `${spell.name}\u0000${spell.class}\u0000${spell.expansion}\u0000${spell.level}`;
}

export function parseEqPriceToCopper(price: string | null | undefined) {
  if (!price?.trim()) return null;

  const unitValues: Record<string, number> = {
    pp: 1000,
    gp: 100,
    sp: 10,
    cp: 1,
  };
  let total = 0;
  let matched = false;
  const pricePattern = /(\d+)\s*(pp|gp|sp|cp)\b/gi;
  let match: RegExpExecArray | null;

  while ((match = pricePattern.exec(price)) !== null) {
    total += Number(match[1]) * unitValues[match[2].toLowerCase()];
    matched = true;
  }

  return matched ? total : null;
}

export function formatCopperAsEqPrice(copper: number | null | undefined) {
  if (copper === null || copper === undefined || !Number.isFinite(copper) || copper <= 0) {
    return "";
  }

  const pp = Math.floor(copper / 1000);
  const gp = Math.floor((copper % 1000) / 100);
  const sp = Math.floor((copper % 100) / 10);
  const cp = copper % 10;
  const parts = [
    pp ? `${pp}pp` : "",
    gp ? `${gp}gp` : "",
    sp ? `${sp}sp` : "",
    cp ? `${cp}cp` : "",
  ].filter(Boolean);

  return parts.join(" ");
}

export function formatEqPriceTotal(total: { knownCopper: number; unknownCount: number }) {
  const knownPrice = formatCopperAsEqPrice(total.knownCopper);
  if (knownPrice && total.unknownCount > 0) return `${knownPrice} + unknown`;
  if (knownPrice) return knownPrice;
  if (total.unknownCount > 0) return "Unknown";
  return "";
}

export function getVendorSpellPriceTotal(spells: VendorRouteSpell[]) {
  const seen = new Set<string>();
  let knownCopper = 0;
  let unknownCount = 0;

  for (const spell of spells) {
    if (seen.has(spell.key)) continue;
    seen.add(spell.key);
    const copper = parseEqPriceToCopper(spell.price);
    if (copper === null) {
      unknownCount += 1;
    } else {
      knownCopper += copper;
    }
  }

  return { knownCopper, unknownCount };
}

export function getShoppingListMinTotal(spells: ShoppingListSpell[]) {
  let knownCopper = 0;
  let unknownCount = 0;

  for (const spell of spells) {
    const vendors = (spell.vendors ?? []).filter(isIncludedVendor);
    if (vendors.length === 0) {
      unknownCount += 1;
      continue;
    }
    let cheapest: number | null = null;
    for (const vendor of vendors) {
      const copper = parseEqPriceToCopper(vendor.price);
      if (copper === null) continue;
      if (cheapest === null || copper < cheapest) cheapest = copper;
    }
    if (cheapest === null) {
      unknownCount += 1;
    } else {
      knownCopper += cheapest;
    }
  }

  return { knownCopper, unknownCount };
}

export function getZoneSpellPriceTotal(vendors: { spells: VendorRouteSpell[] }[]) {
  const spellsByKey = new Map<string, VendorRouteSpell>();

  for (const vendor of vendors) {
    for (const spell of vendor.spells) {
      const current = spellsByKey.get(spell.key);
      if (!current || parseEqPriceToCopper(current.price) === null) {
        spellsByKey.set(spell.key, spell);
      }
    }
  }

  return getVendorSpellPriceTotal(Array.from(spellsByKey.values()));
}

export function getVendorOptionsForShoppingList(spells: ShoppingListSpell[]) {
  const zones = new Map<string, Map<string, { npc: string; spells: VendorRouteSpell[] }>>();

  for (const spell of spells) {
    for (const vendor of spell.vendors ?? []) {
      if (!isIncludedVendor(vendor)) continue;
      const zoneVendors = zones.get(vendor.zone) ?? new Map<string, { npc: string; spells: VendorRouteSpell[] }>();
      const vendorEntry = zoneVendors.get(vendor.npc) ?? { npc: vendor.npc, spells: [] };
      vendorEntry.spells.push({
        key: spellShoppingKey(spell),
        name: spell.name,
        level: spell.level,
        class: spell.class,
        expansion: spell.expansion,
        price: vendor.price,
      });
      zoneVendors.set(vendor.npc, vendorEntry);
      zones.set(vendor.zone, zoneVendors);
    }
  }

  return Array.from(zones.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([zone, zoneVendors]) => {
      const vendors = Array.from(zoneVendors.values())
        .map((vendor) => ({
          ...vendor,
          spells: vendor.spells.sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => a.npc.localeCompare(b.npc));

      return {
        zone,
        vendors,
        totalSpells: new Set(vendors.flatMap((vendor) => vendor.spells.map((spell) => spell.key))).size,
      };
    });
}
