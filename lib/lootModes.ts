export type LootMode = "random" | "normal";

export const lootModes: Array<{ value: LootMode; label: string; enabled: boolean }> = [
  {
    value: "random",
    label: "Random Loot Buckets",
    enabled: true,
  },
  {
    value: "normal",
    label: "Normal Loot",
    enabled: true,
  },
];

export function lootModeLabel(mode: LootMode) {
  return lootModes.find((lootMode) => lootMode.value === mode)?.label ?? mode;
}
