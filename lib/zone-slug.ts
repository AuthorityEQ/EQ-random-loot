import type { Bucket } from "@/lib/search";

/**
 * Converts a zone name to a URL-safe kebab-case slug.
 *
 * Examples:
 *   "Nektulos Forest"     -> "nektulos-forest"
 *   "Plane of Fear"       -> "plane-of-fear"
 *   "East Commonlands"    -> "east-commonlands"
 *   "Qeynos Aqueducts"   -> "qeynos-aqueducts"
 */
export function zoneToSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Reverse-maps a slug back to the canonical zone name by scanning all zones
 * present in the given bucket list.
 *
 * Returns { name, expansion } for the first matching zone, or undefined when
 * no zone in the data resolves to the provided slug.
 */
export function slugToZone(
  slug: string,
  allBuckets: Bucket[],
): { name: string; expansion: string } | undefined {
  for (const bucket of allBuckets) {
    for (const mob of bucket.mobs) {
      if (zoneToSlug(mob.zone) === slug) {
        return { name: mob.zone, expansion: bucket.expansion };
      }
    }
  }
  return undefined;
}
