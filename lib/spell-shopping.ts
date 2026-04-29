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

export function spellShoppingKey(spell: Pick<ShoppingListSpell, "name" | "class" | "expansion" | "level">) {
  return `${spell.name}\u0000${spell.class}\u0000${spell.expansion}\u0000${spell.level}`;
}

export function getVendorOptionsForShoppingList(spells: ShoppingListSpell[]) {
  const zones = new Map<string, Map<string, { npc: string; spells: { key: string; name: string; level: number; class: string; expansion: string; price: string }[] }>>();

  for (const spell of spells) {
    for (const vendor of spell.vendors ?? []) {
      const zoneVendors = zones.get(vendor.zone) ?? new Map<string, { npc: string; spells: { key: string; name: string; level: number; class: string; expansion: string; price: string }[] }>();
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
