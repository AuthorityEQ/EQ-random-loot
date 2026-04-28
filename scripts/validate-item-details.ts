import { readFile } from "node:fs/promises";
import path from "node:path";

type ItemDetails = {
  name?: unknown;
  sources?: unknown;
  confidence?: unknown;
  match_confidence?: unknown;
  match_notes?: unknown;
  missing_core_stats?: unknown;
  duplicate_name_risk?: unknown;
  parsing_warnings?: unknown;
  description?: unknown;
  comments?: unknown;
  images?: unknown;
  icon?: unknown;
};

const root = process.cwd();
const detailsPath = path.join(root, "data", "item-details.json");
const details = JSON.parse(await readFile(detailsPath, "utf8")) as Record<string, ItemDetails>;
const errors: string[] = [];
const forbiddenKeys = ["description", "comments", "guides", "user_posts", "images", "image", "icon", "page_text", "html"];

for (const [itemName, item] of Object.entries(details)) {
  if (typeof item.name !== "string" || item.name.length === 0) {
    errors.push(`${itemName}: missing name`);
  }

  if (!Array.isArray(item.sources)) {
    errors.push(`${itemName}: missing sources array`);
  }

  if (typeof item.confidence !== "string" || item.confidence.length === 0) {
    errors.push(`${itemName}: missing confidence`);
  }

  if (typeof item.match_confidence !== "string" || item.match_confidence.length === 0) {
    errors.push(`${itemName}: missing match_confidence`);
  }

  if (!Array.isArray(item.match_notes)) {
    errors.push(`${itemName}: missing match_notes array`);
  }

  if (typeof item.missing_core_stats !== "boolean") {
    errors.push(`${itemName}: missing missing_core_stats flag`);
  }

  if (typeof item.duplicate_name_risk !== "boolean") {
    errors.push(`${itemName}: missing duplicate_name_risk flag`);
  }

  if (!Array.isArray(item.parsing_warnings)) {
    errors.push(`${itemName}: missing parsing_warnings array`);
  }

  for (const forbiddenKey of forbiddenKeys) {
    if (forbiddenKey in item) {
      errors.push(`${itemName}: forbidden copied-content field "${forbiddenKey}"`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${Object.keys(details).length} item detail records.`);
