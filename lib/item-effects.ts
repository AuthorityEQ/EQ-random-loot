import type { ItemDetails, ItemEffect, ItemEffectType } from "@/lib/search";

export type NormalizedItemEffect = ItemEffect & {
  requiredLevel?: string;
};

export type FocusEffectCategory = "spell" | "bard" | "pet";

export type FocusEffectFamily = {
  category: FocusEffectCategory;
  family: string;
};

const legacyEffectSources: Array<{ type: ItemEffectType; key: keyof ItemDetails }> = [
  { type: "focus", key: "focus_effects" },
  { type: "worn", key: "worn_effects" },
  { type: "click", key: "click_effects" },
  { type: "proc", key: "proc_effects" },
];

const effectLabels: Record<ItemEffectType, string> = {
  focus: "Focus",
  bardMod: "Bard Mod",
  worn: "Worn",
  click: "Click",
  proc: "Proc",
  unknown: "Effect",
};

function cleanRepeatedEffectText(value: string) {
  let cleaned = value.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/\(([^)]*)\)\s*\(\1\)/gi, "($1)");
  cleaned = cleaned.replace(/\b(Any Slot|Can Equip|Combat|Worn|Focus|Click|Proc)\b(?:\s*,\s*\1\b)+/gi, "$1");
  return cleaned;
}

function normalizeLegacyEffect(effect: string, type: ItemEffectType): NormalizedItemEffect | null {
  const raw = String(effect ?? "").trim();
  if (!raw) return null;

  const requiredLevel = raw.match(/\bat Level\s+(\d+)\b/i)?.[1];
  const cleaned = raw
    .replace(/,\s*Casting Time:[^)]+/i, "")
    .replace(/\bat Level\s+\d+\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const baseName = cleaned
    .replace(/\s*\((Combat|Worn|Focus|Click|Proc)[^)]*\)\s*/gi, "")
    .trim();
  const kind = type === "proc"
    ? "Combat"
    : cleaned.match(/\(([^)]+)\)/)?.[1]?.replace(/,\s*Casting Time:.*/i, "").trim();
  const display = cleanRepeatedEffectText(`${baseName}${kind ? ` (${kind})` : ""}`);

  return {
    name: display,
    type,
    requiredLevel,
  };
}

function normalizeStructuredEffect(effect: ItemEffect): NormalizedItemEffect | null {
  const name = String(effect.name ?? "").trim();
  if (!name) return null;

  const type: ItemEffectType = ["focus", "bardMod", "worn", "click", "proc", "unknown"].includes(effect.type)
    ? effect.type
    : "unknown";

  return {
    name: cleanRepeatedEffectText(name),
    type,
    description: effect.description?.trim() || undefined,
  };
}

function effectKey(effect: NormalizedItemEffect) {
  return [
    effect.type,
    effect.name.toLowerCase().replace(/\s+/g, " ").trim(),
    effect.description?.toLowerCase().replace(/\s+/g, " ").trim() ?? "",
  ].join("\u0000");
}

export function effectTypeLabel(type: ItemEffectType) {
  return effectLabels[type] ?? effectLabels.unknown;
}

export function getItemEffects(details: ItemDetails | undefined): NormalizedItemEffect[] {
  if (!details) return [];

  const effects: NormalizedItemEffect[] = [];

  for (const effect of details.effects ?? []) {
    const normalized = normalizeStructuredEffect(effect);
    if (normalized) effects.push(normalized);
  }

  for (const { type, key } of legacyEffectSources) {
    const values = details[key];
    if (!Array.isArray(values)) continue;

    for (const value of values) {
      const normalized = normalizeLegacyEffect(String(value), type);
      if (normalized) effects.push(normalized);
    }
  }

  const seen = new Set<string>();
  return effects.filter((effect) => {
    const key = effectKey(effect);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getFocusEffects(details: ItemDetails | undefined) {
  return getItemEffects(details).filter((effect) => effect.type === "focus" || effect.type === "bardMod");
}

export function itemHasFocusEffect(details: ItemDetails | undefined) {
  return getFocusEffects(details).length > 0;
}

function stripEffectSuffixes(effectName: string) {
  return String(effectName)
    .replace(/(?:\s*\([^)]*\)\s*)+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getFocusEffectCategory(effectName: string): FocusEffectCategory {
  const baseName = stripEffectSuffixes(effectName);
  if (/^(Brass|Percussion|Singing|String|Stringed|Wind)\s+Resonance\b/i.test(baseName)) {
    return "bard";
  }

  if (/^Servant\s+of\s+(Earth|Water)\b/i.test(baseName)) {
    return "pet";
  }

  return "spell";
}

export function normalizeFocusEffectFamily(effectName: string, category: FocusEffectCategory = getFocusEffectCategory(effectName)) {
  const baseName = stripEffectSuffixes(effectName);

  if (category === "bard") {
    return baseName.replace(/\s+\d+$/i, "").trim();
  }

  if (category === "pet") {
    return baseName;
  }

  return baseName.replace(/\s+(I|II|III|IV|V|VI|VII|VIII|IX|X)$/i, "").trim();
}

function focusFamilyKey(effectName: string, category: FocusEffectCategory = getFocusEffectCategory(effectName)) {
  return normalizeFocusEffectFamily(effectName, category).toLowerCase();
}

export function getFocusEffectFamilies(details: ItemDetails | undefined) {
  const families = new Map<string, string>();

  for (const effect of getFocusEffects(details)) {
    const category = getFocusEffectCategory(effect.name);
    const family = normalizeFocusEffectFamily(effect.name, category);
    if (!family) continue;
    const key = focusFamilyKey(family, category);
    if (!families.has(key)) {
      families.set(key, family);
    }
  }

  return Array.from(families.values());
}

export function getFocusEffectFamilyEntries(details: ItemDetails | undefined): FocusEffectFamily[] {
  const families = new Map<string, FocusEffectFamily>();

  for (const effect of getFocusEffects(details)) {
    const category = getFocusEffectCategory(effect.name);
    const family = normalizeFocusEffectFamily(effect.name, category);
    if (!family) continue;
    const key = `${category}\u0000${focusFamilyKey(family, category)}`;
    if (!families.has(key)) {
      families.set(key, { category, family });
    }
  }

  return Array.from(families.values());
}

export function itemMatchesFocusFamily(
  details: ItemDetails | undefined,
  focusFamily: string,
  category?: FocusEffectCategory,
) {
  const targetCategory = category ?? getFocusEffectCategory(focusFamily);
  const targetKey = focusFamilyKey(focusFamily, targetCategory);
  if (!targetKey) return itemHasFocusEffect(details);

  return getFocusEffects(details).some((effect) => {
    const effectCategory = getFocusEffectCategory(effect.name);
    return effectCategory === targetCategory && focusFamilyKey(effect.name, effectCategory) === targetKey;
  });
}

export function itemEffectsMatchQuery(details: ItemDetails | undefined, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) return true;

  return getItemEffects(details).some((effect) =>
    [
      effect.name,
      effect.description,
      effectTypeLabel(effect.type),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
  );
}

export function itemEffectSearchText(details: ItemDetails | undefined) {
  return getItemEffects(details).flatMap((effect) => [
    effect.name,
    effect.description ?? "",
    effectTypeLabel(effect.type),
  ]).filter(Boolean);
}
