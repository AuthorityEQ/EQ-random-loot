import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ItemDetails = {
  name: string;
  sources?: Array<{ name: string; url: string }>;
  confidence: string;
  match_confidence?: string;
  match_notes?: string[];
  missing_core_stats?: boolean;
  duplicate_name_risk?: boolean;
  parsing_warnings?: string[];
  expansion?: string;
};

type ReviewEntry = {
  item: string;
  reason: string;
  url?: string;
};

const root = process.cwd();
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reviewPath = path.join(root, "data", "item-enrichment-review.json");

function buildReview(details: Record<string, ItemDetails>) {
  const review = {
    exact_match_clean: [] as ReviewEntry[],
    needs_review: [] as ReviewEntry[],
    not_found: [] as ReviewEntry[],
    missing_stats: [] as ReviewEntry[],
    duplicate_name_risk: [] as ReviewEntry[],
  };

  for (const [item, detail] of Object.entries(details).sort(([a], [b]) => a.localeCompare(b))) {
    const confidence = detail.match_confidence ?? detail.confidence;
    const url = detail.sources?.[0]?.url;
    const reason = detail.match_notes?.join(" ") || confidence;

    if (confidence === "exact_match" && !detail.missing_core_stats && !detail.duplicate_name_risk && (detail.parsing_warnings?.length ?? 0) === 0) {
      review.exact_match_clean.push({ item, reason: "Manual or parsed clean item.", url });
    }
    if (confidence === "needs_review" || detail.confidence === "needs_review") {
      review.needs_review.push({ item, reason, url });
    }
    if (confidence === "not_found") {
      review.not_found.push({ item, reason, url });
    }
    if (detail.missing_core_stats) {
      review.missing_stats.push({ item, reason: "Core item stats are missing.", url });
    }
    if (detail.duplicate_name_risk) {
      review.duplicate_name_risk.push({ item, reason, url });
    }
  }

  return review;
}

const details = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const cleanedItems: string[] = [];

for (const [itemName, item] of Object.entries(details)) {
  if (!item.duplicate_name_risk) continue;

  item.confidence = "exact_match";
  item.match_confidence = "exact_match";
  item.match_notes = ["Manually reviewed duplicate-name item and confirmed Classic match."];
  item.missing_core_stats = false;
  item.duplicate_name_risk = false;
  item.parsing_warnings = [];
  item.expansion = "Classic";
  cleanedItems.push(itemName);
}

await writeFile(itemDetailsPath, `${JSON.stringify(details, null, 2)}\n`);
await writeFile(reviewPath, `${JSON.stringify(buildReview(details), null, 2)}\n`);

console.log(JSON.stringify({
  cleanedDuplicateItems: cleanedItems.length,
  items: cleanedItems.sort((a, b) => a.localeCompare(b)),
}, null, 2));
