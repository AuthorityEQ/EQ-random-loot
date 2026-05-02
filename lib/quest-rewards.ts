import { questRewardMappings, type QuestRewardMapping } from "@/data/questRewardMappings";

export type { QuestRewardMapping };

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeId(value: string) {
  const trimmed = value.trim().toLowerCase();
  return trimmed.startsWith("zam:") ? trimmed.slice(4) : trimmed;
}

function matchesItemIdentifier(input: string, itemName: string | undefined, itemId?: string) {
  const normalizedInputName = normalizeName(input);
  if (itemName && normalizedInputName === normalizeName(itemName)) return true;
  if (!itemId) return false;

  const normalizedInputId = normalizeId(input);
  return normalizedInputId === itemId || normalizedInputId === `item:${itemId}`;
}

export function getQuestRewardsForSourceItem(itemNameOrId: string) {
  return questRewardMappings.filter((mapping) =>
    matchesItemIdentifier(itemNameOrId, mapping.sourceItemName, mapping.sourceItemId),
  );
}

export function getQuestSourceItemsForRewardItem(itemNameOrId: string) {
  return questRewardMappings.filter((mapping) =>
    matchesItemIdentifier(itemNameOrId, mapping.rewardItemName, mapping.rewardItemId),
  );
}
