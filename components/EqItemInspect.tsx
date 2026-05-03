import { effectTypeLabel, getItemEffects, type NormalizedItemEffect } from "@/lib/item-effects";
import { getQuestRewardsForSourceItem, getQuestSourceItemsForRewardItem, type QuestRewardMapping } from "@/lib/quest-rewards";
import type { ItemDetails, ItemEffectType } from "@/lib/search";
import { Fragment } from "react";

type EqItemInspectProps = {
  itemName: string;
  details: ItemDetails;
  compact?: boolean;
};

const attributeLabels: Record<string, string> = {
  STR: "Strength",
  STA: "Stamina",
  DEX: "Dexterity",
  AGI: "Agility",
  INT: "Intelligence",
  WIS: "Wisdom",
  CHA: "Charisma",
};

const resistLabels: Record<string, string> = {
  MR: "Magic",
  FR: "Fire",
  CR: "Cold",
  DR: "Disease",
  PR: "Poison",
  CORRUPTION: "Corruption",
};

type OptionalInspectFields = {
  skill?: string | number | null;
  damage_bonus?: string | number | null;
  dmg_bonus?: string | number | null;
  manaRegen?: number | null;
  atk?: number | null;
  attack?: number | null;
  fire_damage?: string | number | null;
  cold_damage?: string | number | null;
  magic_damage?: string | number | null;
  disease_damage?: string | number | null;
  poison_damage?: string | number | null;
  iconPath?: string | null;
  icon?: string | null;
  icon_url?: string | null;
  extraStats?: Record<string, string | number | boolean>;
};

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
}

function hasNonZeroValue(value: unknown) {
  return hasValue(value) && value !== 0 && value !== "0";
}

function formatValue(value: number | string) {
  return String(value).replace(/^\+/, "");
}

function formatStatValue(label: string, value: number | string) {
  if (label === "Weight" && typeof value === "number") {
    return value.toFixed(1);
  }

  return formatValue(value);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/([\s/]+)/)
    .map((part) => (/^[a-z]/.test(part) ? part[0].toUpperCase() + part.slice(1) : part))
    .join("");
}

function formatExtraStatLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function StatPair({ label, value }: { label?: string; value?: number | string | null }) {
  if (!label || !hasValue(value)) {
    return (
      <>
        <span className="eq-stat-label is-empty" />
        <strong className="eq-stat-value is-empty" />
      </>
    );
  }

  return (
    <>
      <span className="eq-stat-label">{label}:</span>
      <strong className="eq-stat-value">{formatStatValue(label, value as number | string)}</strong>
    </>
  );
}

function normalizeEffect(effect: string, combat = false) {
  const levelMatch = effect.match(/\bat Level\s+(\d+)\b/i);
  const cleaned = effect
    .replace(/,\s*Casting Time:[^)]+/i, "")
    .replace(/\bat Level\s+\d+\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const baseName = cleaned
    .replace(/\s*\((Combat|Worn|Focus|Click)[^)]*\)\s*/gi, "")
    .trim();
  const kind = combat ? "Combat" : cleaned.match(/\(([^)]+)\)/)?.[1]?.replace(/,\s*Casting Time:.*/i, "").trim();

  return {
    display: cleanRepeatedEffectText(`${baseName}${kind ? ` (${kind})` : ""}`),
    name: baseName,
    requiredLevel: levelMatch?.[1],
  };
}

function cleanRepeatedEffectText(value: string) {
  let cleaned = value.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/\(([^)]*)\)\s*\(\1\)/gi, "($1)");
  cleaned = cleaned.replace(/\b(Any Slot|Can Equip|Combat|Worn|Focus|Click)\b(?:\s*,\s*\1\b)+/gi, "$1");
  return cleaned;
}

function effectKey(label: string, effect: string, combat = false) {
  const normalized = normalizeEffect(effect, combat);
  return `${label.toLowerCase()}\u0000${normalized.display.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function uniqueEffects(label: string, effects: string[], combat = false) {
  const seen = new Set<string>();
  return effects.filter((effect) => {
    const key = effectKey(label, effect, combat);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectEffectSections(details: ItemDetails) {
  const order: ItemEffectType[] = ["focus", "bardMod", "worn", "click", "proc", "unknown"];
  const grouped = new Map<ItemEffectType, NormalizedItemEffect[]>();

  for (const effect of getItemEffects(details)) {
    grouped.set(effect.type, [...(grouped.get(effect.type) ?? []), effect]);
  }

  return order.map((type) => ({
    label: effectTypeLabel(type),
    effects: grouped.get(type) ?? [],
  }));
}

function EffectLine({ label, effects }: { label: string; effects: NormalizedItemEffect[] }) {
  if (effects.length === 0) return null;

  return (
    <>
      {effects.map((effect) => (
        <div className="eq-effect-entry" key={`${label}-${effect.name}-${effect.description ?? ""}`}>
          <p className="eq-effect-line">
            <span>{label}: </span>
            <strong>{effect.name}</strong>
          </p>
          {effect.description ? <p className="eq-effect-description">{effect.description}</p> : null}
          {effect.requiredLevel ? <p>Required Level: {effect.requiredLevel}</p> : null}
        </div>
      ))}
    </>
  );
}

function visibleRows(rows: ReadonlyArray<readonly [string, number | string | null | undefined]>) {
  return rows.filter(([, value]) => hasValue(value));
}

function StatMatrix({
  columns,
  weapon = false,
}: {
  columns: ReadonlyArray<ReadonlyArray<readonly [string, number | string | null | undefined]>>;
  weapon?: boolean;
}) {
  const visibleColumns = columns.map(visibleRows);
  const maxRows = Math.max(...visibleColumns.map((rows) => rows.length));

  if (maxRows === 0) return null;

  return (
    <div className={weapon ? "eq-stat-matrix is-weapon" : "eq-stat-matrix"} aria-hidden={false}>
      {Array.from({ length: maxRows }).map((_, rowIndex) =>
        visibleColumns.map((rows, columnIndex) => {
          const row = rows[rowIndex];

          return (
            <StatPair
              key={`${columnIndex}-${rowIndex}-${row?.[0] ?? "empty"}`}
              label={row?.[0]}
              value={row?.[1] ?? null}
            />
          );
        }),
      )}
    </div>
  );
}

function AttributeResistMatrix({
  attributes,
  resists,
}: {
  attributes: ReadonlyArray<readonly [string, number | string | null | undefined]>;
  resists: ReadonlyArray<readonly [string, number | string | null | undefined]>;
}) {
  const attributeRows = visibleRows(attributes);
  const resistRows = visibleRows(resists);
  const maxRows = Math.max(attributeRows.length, resistRows.length);

  if (maxRows === 0) return null;

  return (
    <div className="eq-attribute-resist-grid">
      {Array.from({ length: maxRows }).map((_, index) => (
        <Fragment key={index}>
          <StatPair label={attributeRows[index]?.[0]} value={attributeRows[index]?.[1] ?? null} />
          <StatPair label={resistRows[index]?.[0]} value={resistRows[index]?.[1] ?? null} />
        </Fragment>
      ))}
    </div>
  );
}

function formatClasses(classes?: string[]) {
  return classes && classes.length > 0 ? classes.join(" ") : null;
}

function QuestRewardBlock({
  compact,
  mappings,
}: {
  compact: boolean;
  mappings: QuestRewardMapping[];
}) {
  if (mappings.length === 0) return null;

  return (
    <div className="eq-quest-rewards-block">
      <p className="eq-quest-heading">{compact ? "Can be turned in for" : "Quest Rewards"}</p>
      <ul className="eq-quest-reward-list">
        {mappings.map((mapping) => (
          <li key={`${mapping.sourceItemId}-${mapping.rewardItemId}-${mapping.questName}`}>
            <strong>{mapping.rewardItemName}</strong>
            <span>
              {[mapping.rewardSlot ? `Slot: ${mapping.rewardSlot}` : null, formatClasses(mapping.rewardClasses) ? `Class: ${formatClasses(mapping.rewardClasses)}` : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <small>
              {[mapping.questName, mapping.questId ? `Quest ${mapping.questId}` : null, mapping.sourceNpcName ? `Source: ${mapping.sourceNpcName}` : null].filter(Boolean).join(" · ")}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuestSourceBlock({
  compact,
  mappings,
}: {
  compact: boolean;
  mappings: QuestRewardMapping[];
}) {
  if (mappings.length === 0) return null;

  return (
    <div className="eq-quest-rewards-block">
      <p className="eq-quest-heading">{compact ? "Quest reward from" : "Quest Source"}</p>
      <ul className="eq-quest-reward-list">
        {mappings.map((mapping) => (
          <li key={`${mapping.rewardItemId}-${mapping.sourceItemId}-${mapping.questName}`}>
            <strong>{mapping.sourceItemName ?? (mapping.questId ? `Quest ${mapping.questId}` : "Quest reward")}</strong>
            <span>{[mapping.questId ? `Source: Quest ${mapping.questId}` : null, mapping.sourceNpcName, mapping.questName].filter(Boolean).join(" · ")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EqItemInspect({ itemName, details, compact = false }: EqItemInspectProps) {
  const optional = details as ItemDetails & OptionalInspectFields;
  const flags = [
    details.magic ? "Magic" : null,
    details.lore ? "Lore" : null,
    details.no_drop ? "No Drop" : null,
    details.prestige ? "Prestige" : null,
  ].filter(Boolean);
  const topLines = [
    flags.length > 0 ? flags.join(" ") : null,
    details.classes.length > 0 ? `Class: ${details.classes.join(" ")}` : null,
    details.races.length > 0 ? `Race: ${details.races.join(" ")}` : null,
    details.slot ? titleCase(details.slot) : null,
  ].filter(Boolean);
  const hasWeaponStats = hasValue(details.damage)
    || hasValue(details.delay)
    || hasValue(optional.damage_bonus)
    || hasValue(optional.dmg_bonus)
    || hasValue(optional.skill);
  const leftRows: Array<[string, number | string | null | undefined]> = [
    ["Size", details.size],
    ["Weight", details.weight],
    ["Req Level", details.required_level],
    ["Rec Level", details.recommended_level],
    ["Skill", optional.skill],
  ];
  const middleRows: Array<[string, number | string | null | undefined]> = [
    ["AC", details.ac],
    ["HP", details.stats.HP],
    ["Mana", details.stats.MANA],
    ["End", details.stats.END],
    ["Attack", hasNonZeroValue(optional.attack ?? optional.atk) ? optional.attack ?? optional.atk : null],
    ["HP Regen", details.hp_regen],
    ["Mana Regen", hasNonZeroValue(optional.manaRegen ?? details.mana_regen) ? optional.manaRegen ?? details.mana_regen : null],
    ["End Regen", details.endurance_regen],
  ];
  const rightRows: Array<[string, number | string | null | undefined]> = [
    ["Base Dmg", details.damage],
    ["Fire Dmg", optional.fire_damage],
    ["Cold Dmg", optional.cold_damage],
    ["Magic Dmg", optional.magic_damage],
    ["Disease Dmg", optional.disease_damage],
    ["Poison Dmg", optional.poison_damage],
    ["Delay", details.delay],
    ["Dmg Bon", optional.damage_bonus ?? optional.dmg_bonus],
  ];
  const hasteRows: Array<[string, number | string | null | undefined]> = [["Haste", details.haste]];
  const containerRows: Array<[string, number | string | null | undefined]> = [
    ["Item Type", details.item_type],
    ["Capacity", details.capacity],
    ["WR", details.weight_reduction],
    ["Size Cap", details.size_capacity],
    ["Stackable", typeof details.stackable === "boolean" ? (details.stackable ? "Yes" : "No") : null],
  ];
  const extraRows: Array<[string, number | string | null | undefined]> = Object.entries(optional.extraStats ?? {})
    .filter(([, value]) => hasValue(value))
    .map(([key, value]) => [formatExtraStatLabel(key), typeof value === "boolean" ? (value ? "Yes" : "No") : value]);
  const attributeRows = Object.entries(attributeLabels).map(([key, label]) => [label, details.stats[key]] as const);
  const resistRows = Object.entries(resistLabels).map(([key, label]) => [label, details.resists[key]] as const);
  const effectSections = collectEffectSections(details);
  const hasEffects = effectSections.some((section) => section.effects.length > 0);
  const questRewards = getQuestRewardsForSourceItem(itemName);
  const questSources = getQuestSourceItemsForRewardItem(itemName);
  const hasQuestMappings = questRewards.length > 0 || questSources.length > 0;
  const itemNameClass = details.no_drop ? "eq-item-name is-nodrop" : details.magic ? "eq-item-name is-magic" : "eq-item-name";
  const iconUrl = optional.iconPath ?? optional.icon_url ?? optional.icon;
  const inspectClass = [
    "eq-inspect-window",
    hasWeaponStats || hasEffects || hasQuestMappings ? "is-detailed" : null,
    compact ? "is-compact" : null,
  ].filter(Boolean).join(" ");

  return (
    <section className={inspectClass} aria-label={`${itemName} EverQuest item inspect`}>
      <div className="eq-title-bar">{itemName}</div>
      <div className="eq-window-body">
        <h3>Description</h3>

        <div className="eq-top-block">
          {iconUrl ? (
            <img alt="" aria-hidden="true" className="eq-item-icon" src={iconUrl} />
          ) : (
            <div className="eq-icon-placeholder" aria-hidden="true" />
          )}
          <div className="eq-item-summary">
            <p className={itemNameClass}>{itemName}</p>
            {topLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <StatMatrix
          columns={hasWeaponStats
            ? [leftRows, middleRows, rightRows.concat(hasValue(details.haste) ? hasteRows : [])]
            : [leftRows.concat(containerRows), middleRows.concat(hasWeaponStats ? [] : hasteRows)]}
          weapon={hasWeaponStats}
        />

        <AttributeResistMatrix attributes={attributeRows} resists={resistRows} />

        {extraRows.length > 0 ? (
          <div className="eq-extra-stats-block">
            <p className="eq-quest-heading">Additional</p>
            <StatMatrix columns={[extraRows]} />
          </div>
        ) : null}

        {hasEffects ? (
          <div className="eq-effects-block">
            {effectSections.map((section) => (
              <EffectLine effects={section.effects} key={section.label} label={section.label} />
            ))}
            {hasValue(details.charges) ? (
              <p className="eq-effect-line">
                <span>Charges: </span>
                <strong>{formatValue(details.charges as number | string)}</strong>
              </p>
            ) : null}
          </div>
        ) : null}

        <QuestRewardBlock compact={compact} mappings={questRewards} />
        <QuestSourceBlock compact={compact} mappings={questSources} />
      </div>
    </section>
  );
}
