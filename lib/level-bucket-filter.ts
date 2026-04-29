import type { Bucket } from "@/lib/search";

export function parseBucketRange(range: string) {
  const trimmed = range.trim();
  const plusMatch = trimmed.match(/^(\d+)\+$/);
  if (plusMatch) {
    return { min: Number(plusMatch[1]), max: Number.POSITIVE_INFINITY };
  }

  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };
  }

  const singleValue = Number.parseInt(trimmed, 10);
  return Number.isFinite(singleValue) ? { min: singleValue, max: singleValue } : { min: 1, max: Number.POSITIVE_INFINITY };
}

function bucketContainsLevel(bucket: Bucket, level: number) {
  const range = parseBucketRange(bucket.level_range);
  return level >= range.min && level <= range.max;
}

export function visibleBucketsForLevel(buckets: Bucket[], level: number) {
  const grouped = new Map<string, Bucket[]>();

  for (const bucket of buckets) {
    grouped.set(bucket.expansion, [...(grouped.get(bucket.expansion) ?? []), bucket]);
  }

  const visible = new Set<Bucket>();

  for (const expansionBuckets of grouped.values()) {
    const sorted = [...expansionBuckets].sort((a, b) => parseBucketRange(a.level_range).min - parseBucketRange(b.level_range).min);
    const currentIndex = sorted.findIndex((bucket) => bucketContainsLevel(bucket, level));
    let fallbackIndex = -1;
    for (let index = 0; index < sorted.length; index += 1) {
      if (parseBucketRange(sorted[index].level_range).min <= level) {
        fallbackIndex = index;
      }
    }
    const effectiveIndex = currentIndex === -1 ? fallbackIndex : currentIndex;

    if (effectiveIndex <= 0) {
      for (const bucket of sorted) visible.add(bucket);
      continue;
    }

    const threshold = parseBucketRange(sorted[effectiveIndex - 1].level_range).min;
    for (const bucket of sorted) {
      if (parseBucketRange(bucket.level_range).min >= threshold) {
        visible.add(bucket);
      }
    }
  }

  return visible;
}
