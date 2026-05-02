import type { ItemDetails } from "@/lib/search";

export type WeaponType = "1H" | "2H" | "shield" | "ranged" | "other";

type WeaponFields = Pick<ItemDetails, "name" | "slot" | "item_type" | "itemType"> & {
  skill?: string | number | null;
  weaponType?: WeaponType | null;
  isTwoHanded?: boolean | null;
};

function normalizedText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function inferWeaponType(item: Partial<WeaponFields> | null | undefined): WeaponType | null {
  if (!item) return null;

  const itemName = normalizedText(item.name);
  const slot = normalizedText(item.slot).toUpperCase();
  const skill = normalizedText(item.skill);
  const itemType = normalizedText(item.itemType);
  const legacyItemType = normalizedText(item.item_type);
  const shieldText = `${itemType} ${legacyItemType} ${skill}`;
  if (/\bbuckler\b/i.test(itemName) || /\bshield\b/i.test(shieldText)) {
    return "shield";
  }

  if (item.weaponType) return item.weaponType;
  if (item.isTwoHanded === true) return "2H";

  const combined = `${skill} ${itemType} ${legacyItemType}`;

  if (/\b(?:2H|2HB|2HS|2HP|2\s*H|two[-\s]?hand(?:ed)?)\b/i.test(combined)) {
    return "2H";
  }

  if (/\b(?:1H|1HB|1HS|1HP|1\s*H|one[-\s]?hand(?:ed)?)\b/i.test(combined)) {
    return "1H";
  }

  if (/\bshield\b/i.test(combined)) {
    return "shield";
  }

  if (slot.includes("RANGE") || slot.includes("RANGED")) {
    return "ranged";
  }

  if (slot.includes("PRIMARY")) {
    return "other";
  }

  return null;
}

export function isTwoHandedItem(item: Partial<WeaponFields> | null | undefined) {
  return inferWeaponType(item) === "2H";
}

export function isShieldItem(item: Partial<WeaponFields> | null | undefined) {
  return inferWeaponType(item) === "shield";
}
