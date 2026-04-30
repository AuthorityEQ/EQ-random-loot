import type { ItemDetailsMap } from "@/lib/search";

/**
 * Converts an item name to a URL-safe kebab-case slug.
 * e.g. "Cloak of Flames" -> "cloak-of-flames"
 * e.g. "Tolan's Darkwood Fists" -> "tolans-darkwood-fists"
 *
 * If two distinct item names produce the same base slug, the second one
 * should have been registered with a numeric suffix (see buildItemSlugMap).
 * This function only handles the forward direction; collision resolution
 * happens at build time in buildItemSlugMap.
 */
export function itemToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, "") // strip apostrophes / smart quotes before removing non-alnum
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build a bidirectional map of slug <-> item name.
 * When two names produce the same base slug the second occurrence gets a
 * numeric suffix appended: "foo-bar-2", "foo-bar-3", …
 *
 * Returns { slugToName, nameToSlug }.
 */
export function buildItemSlugMap(allItems: ItemDetailsMap): {
  slugToName: Map<string, string>;
  nameToSlug: Map<string, string>;
} {
  const slugToName = new Map<string, string>();
  const nameToSlug = new Map<string, string>();

  for (const name of Object.keys(allItems)) {
    const base = itemToSlug(name);
    if (!slugToName.has(base)) {
      slugToName.set(base, name);
      nameToSlug.set(name, base);
    } else {
      // Collision — append an incrementing suffix
      let suffix = 2;
      let candidate = `${base}-${suffix}`;
      while (slugToName.has(candidate)) {
        suffix++;
        candidate = `${base}-${suffix}`;
      }
      slugToName.set(candidate, name);
      nameToSlug.set(name, candidate);
    }
  }

  return { slugToName, nameToSlug };
}

/**
 * Resolve a slug back to the canonical item name.
 * Returns undefined when the slug is not found.
 */
export function slugToItemName(
  slug: string,
  allItems: ItemDetailsMap,
): string | undefined {
  const { slugToName } = buildItemSlugMap(allItems);
  return slugToName.get(slug);
}
