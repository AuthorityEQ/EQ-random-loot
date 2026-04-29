import type { ItemDetails } from "@/lib/search";
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
  fire_damage?: string | number | null;
  cold_damage?: string | number | null;
  magic_damage?: string | number | null;
  disease_damage?: string | number | null;
  poison_damage?: string | number | null;
  iconPath?: string | null;
  icon?: string | null;
  icon_url?: string | null;
};

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
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
  const seen = new Set<string>();
  const sections = [
    { label: "Worn Effect", effects: details.worn_effects, combat: false },
    { label: "Focus Effect", effects: details.focus_effects, combat: false },
    { label: "Effect", effects: details.click_effects, combat: false },
    { label: "Effect", effects: details.proc_effects, combat: true },
  ];

  return sections.map((section) => ({
    ...section,
    effects: section.effects.filter((effect) => {
      const normalized = normalizeEffect(effect, section.combat);
      const key = normalized.display.toLowerCase().replace(/\s+/g, " ").trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  }));
}

function EffectLine({ label, effects, combat = false }: { label: string; effects: string[]; combat?: boolean }) {
  if (effects.length === 0) return null;

  return (
    <>
      {uniqueEffects(label, effects, combat).map((effect) => {
        const normalized = normalizeEffect(effect, combat);

        return (
          <div className="eq-effect-entry" key={`${label}-${effect}`}>
            <p className="eq-effect-line">
              <span>{label}: </span>
              <strong>{normalized.display}</strong>
            </p>
            {normalized.requiredLevel ? <p>Required Level: {normalized.requiredLevel}</p> : null}
          </div>
        );
      })}
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
    ["HP Regen", details.hp_regen],
    ["Mana Regen", details.mana_regen],
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
  const attributeRows = Object.entries(attributeLabels).map(([key, label]) => [label, details.stats[key]] as const);
  const resistRows = Object.entries(resistLabels).map(([key, label]) => [label, details.resists[key]] as const);
  const hasEffects = details.worn_effects.length > 0
    || details.focus_effects.length > 0
    || details.click_effects.length > 0
    || details.proc_effects.length > 0;
  const effectSections = collectEffectSections(details);
  const itemNameClass = details.no_drop ? "eq-item-name is-nodrop" : details.magic ? "eq-item-name is-magic" : "eq-item-name";
  const iconUrl = optional.iconPath ?? optional.icon_url ?? optional.icon;
  const inspectClass = [
    "eq-inspect-window",
    hasWeaponStats || hasEffects ? "is-detailed" : null,
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

        {hasEffects ? (
          <div className="eq-effects-block">
            {effectSections.map((section) => (
              <EffectLine combat={section.combat} effects={section.effects} key={`${section.label}-${section.combat}`} label={section.label} />
            ))}
            {hasValue(details.charges) ? (
              <p className="eq-effect-line">
                <span>Charges: </span>
                <strong>{formatValue(details.charges as number | string)}</strong>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
