"use client";

import { useMemo, useState } from "react";
import itemDetailsData from "@/data/item-details.json";
import { ItemIcon } from "@/components/ItemIcon";
import type { ItemDetails } from "@/lib/search";

type ArmorSet = "Thurgadin" | "Kael" | "Skyshrine";
type PreviewBuild = Partial<Record<PreviewSlotId, ArmorItem>>;

type ArmorItem = ItemDetails & {
  armorSet?: string;
};

type ArmorSlotId = "HEAD" | "CHEST" | "ARMS" | "WRIST" | "HANDS" | "LEGS" | "FEET";
type PreviewSlotId = "HEAD" | "CHEST" | "ARMS" | "WRIST1" | "WRIST2" | "HANDS" | "LEGS" | "FEET";

const itemDetails = itemDetailsData as Record<string, ItemDetails>;
const armorSets: ArmorSet[] = ["Thurgadin", "Kael", "Skyshrine"];
const armorSetClassNames: Record<ArmorSet, string> = {
  Thurgadin: "is-thurgadin",
  Kael: "is-kael",
  Skyshrine: "is-skyshrine",
};
const factionSummaries = [
  {
    set: "Thurgadin",
    label: "Dwarf armor",
    faction: "Coldain",
  },
  {
    set: "Kael",
    label: "Giant armor",
    faction: "Kromzek / Kromrif",
  },
  {
    set: "Skyshrine",
    label: "Dragon armor",
    faction: "Claws of Veeshan",
  },
] as const;
const armorSlots: Array<{ id: ArmorSlotId; label: string }> = [
  { id: "HEAD", label: "Head" },
  { id: "CHEST", label: "Chest" },
  { id: "ARMS", label: "Arms" },
  { id: "WRIST", label: "Wrist" },
  { id: "HANDS", label: "Hands" },
  { id: "LEGS", label: "Legs" },
  { id: "FEET", label: "Feet" },
];
const previewSlots: Array<{ id: PreviewSlotId; itemSlotId: ArmorSlotId; label: string }> = [
  { id: "HEAD", itemSlotId: "HEAD", label: "Head" },
  { id: "CHEST", itemSlotId: "CHEST", label: "Chest" },
  { id: "ARMS", itemSlotId: "ARMS", label: "Arms" },
  { id: "WRIST1", itemSlotId: "WRIST", label: "Wrist 1" },
  { id: "WRIST2", itemSlotId: "WRIST", label: "Wrist 2" },
  { id: "HANDS", itemSlotId: "HANDS", label: "Hands" },
  { id: "LEGS", itemSlotId: "LEGS", label: "Legs" },
  { id: "FEET", itemSlotId: "FEET", label: "Feet" },
];
const statOrder = ["STR", "STA", "AGI", "DEX", "WIS", "INT", "CHA"] as const;
const resistOrder = ["MR", "FR", "CR", "DR", "PR"] as const;

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function itemHp(item?: ArmorItem) {
  return numberValue(item?.stats?.HP);
}

function itemMana(item?: ArmorItem) {
  return numberValue(item?.stats?.MANA);
}

function metricLine(metrics: Array<[string, number]>) {
  return metrics
    .filter(([, value]) => value > 0)
    .map(([label, value]) => `${label} ${value}`)
    .join(" · ");
}

function itemStatSummary(item?: ArmorItem) {
  if (!item) return "";
  const stats = statOrder
    .map((key) => [key, numberValue(item.stats?.[key])] as const)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${key} ${value > 0 ? "+" : ""}${value}`);
  const resists = resistOrder
    .map((key) => [key, numberValue(item.resists?.[key])] as const)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${key} ${value > 0 ? "+" : ""}${value}`);

  return [...stats, ...resists].slice(0, 8).join(" / ");
}

function totalStats(items: ArmorItem[]) {
  const totals: Record<string, number> = {};
  for (const item of items) {
    for (const key of [...statOrder, ...resistOrder]) {
      const value = numberValue(item.stats?.[key]) + numberValue(item.resists?.[key]);
      if (value !== 0) totals[key] = (totals[key] ?? 0) + value;
    }
  }
  return [...statOrder, ...resistOrder]
    .map((key) => [key, totals[key] ?? 0] as const)
    .filter(([, value]) => value > 0);
}

function statLine(items: ArmorItem[], keys: readonly string[]) {
  const totals: Record<string, number> = {};
  for (const item of items) {
    for (const key of keys) {
      const value = numberValue(item.stats?.[key]) + numberValue(item.resists?.[key]);
      if (value !== 0) totals[key] = (totals[key] ?? 0) + value;
    }
  }

  return keys
    .map((key) => [key, totals[key] ?? 0] as const)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${key} ${value > 0 ? "+" : ""}${value}`)
    .join(" · ");
}

function cleanStatLine(items: ArmorItem[], keys: readonly string[]) {
  const totals: Record<string, number> = {};
  for (const item of items) {
    for (const key of keys) {
      const value = numberValue(item.stats?.[key]) + numberValue(item.resists?.[key]);
      if (value > 0) totals[key] = (totals[key] ?? 0) + value;
    }
  }

  return keys
    .map((key) => [key, totals[key] ?? 0] as const)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${key} +${value}`)
    .join(" · ");
}

function setTotals(armorIndex: Partial<Record<ArmorSlotId, Partial<Record<ArmorSet, ArmorItem>>>>, armorSet: ArmorSet) {
  const items = previewSlots
    .map((slot) => armorIndex[slot.itemSlotId]?.[armorSet])
    .filter((item): item is ArmorItem => Boolean(item));

  return {
    ac: items.reduce((sum, item) => sum + numberValue(item.ac), 0),
    hp: items.reduce((sum, item) => sum + itemHp(item), 0),
    mana: items.reduce((sum, item) => sum + itemMana(item), 0),
    pieceCount: items.length,
    stats: cleanStatLine(items, statOrder),
    resists: cleanStatLine(items, resistOrder),
  };
}

function itemIdentity(item: ArmorItem) {
  return item.itemId ?? item.name;
}

function isWristPreviewSlot(slot: PreviewSlotId) {
  return slot === "WRIST1" || slot === "WRIST2";
}

function pairedWristSlot(slot: PreviewSlotId): PreviewSlotId | null {
  if (slot === "WRIST1") return "WRIST2";
  if (slot === "WRIST2") return "WRIST1";
  return null;
}

function isVeliousClassArmor(item: ItemDetails): item is ArmorItem {
  return item.expansion === "Velious"
    && item.acquisitionType === "quest"
    && item.sourceCategory === "Velious class armor"
    && armorSets.includes(item.armorSet as ArmorSet);
}

function itemMatchesClass(item: ArmorItem, classCode: string) {
  return item.classes?.includes(classCode) || item.classes?.includes("ALL");
}

function itemSlotId(item: ArmorItem): ArmorSlotId | null {
  const slot = String(item.slot ?? "").toUpperCase();
  return armorSlots.some((entry) => entry.id === slot) ? slot as ArmorSlotId : null;
}

function buildArmorIndex(classCode: string) {
  const index: Partial<Record<ArmorSlotId, Partial<Record<ArmorSet, ArmorItem>>>> = {};

  for (const item of Object.values(itemDetails)) {
    if (!isVeliousClassArmor(item) || !itemMatchesClass(item, classCode)) continue;
    const slot = itemSlotId(item);
    const armorSet = item.armorSet as ArmorSet;
    if (!slot) continue;
    index[slot] = {
      ...index[slot],
      [armorSet]: item,
    };
  }

  return index;
}

const classOptions = Array.from(
  new Set(
    Object.values(itemDetails)
      .filter(isVeliousClassArmor)
      .flatMap((item) => item.classes ?? [])
      .filter((classCode) => classCode !== "ALL"),
  ),
).sort((a, b) => a.localeCompare(b));

function ArmorCell({
  item,
  isSelected,
  onSelect,
}: {
  item?: ArmorItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  if (!item) {
    return <div className="velious-armor-missing">Missing item data</div>;
  }
  const metrics = metricLine([
    ["AC", numberValue(item.ac)],
    ["HP", itemHp(item)],
    ["Mana", itemMana(item)],
  ]);

  return (
    <button
      className={isSelected ? "velious-armor-item is-selected" : "velious-armor-item"}
      onClick={onSelect}
      type="button"
    >
      <ItemIcon details={item} />
      <span>
        <strong>{item.name}</strong>
        {metrics ? <small>{metrics}</small> : null}
        <em>{itemStatSummary(item) || "No key stats"}</em>
      </span>
    </button>
  );
}

export function VeliousClassArmorBuilder() {
  const [selectedClass, setSelectedClass] = useState(classOptions[0] ?? "WAR");
  const [previewBuild, setPreviewBuild] = useState<PreviewBuild>({});
  const [previewWarning, setPreviewWarning] = useState("");
  const armorIndex = useMemo(() => buildArmorIndex(selectedClass), [selectedClass]);
  const previewItems = previewSlots.map((slot) => previewBuild[slot.id]).filter((item): item is ArmorItem => Boolean(item));
  const totals = {
    ac: previewItems.reduce((sum, item) => sum + numberValue(item.ac), 0),
    hp: previewItems.reduce((sum, item) => sum + itemHp(item), 0),
    mana: previewItems.reduce((sum, item) => sum + itemMana(item), 0),
    stats: totalStats(previewItems),
  };
  const previewMetrics = [
    ["Total AC", totals.ac],
    ["Total HP", totals.hp],
    ["Total Mana", totals.mana],
  ] as const;

  function selectClass(classCode: string) {
    setSelectedClass(classCode);
    setPreviewBuild({});
    setPreviewWarning("");
  }

  function selectItem(slot: PreviewSlotId, item: ArmorItem) {
    const pairedSlot = pairedWristSlot(slot);
    const pairedItem = pairedSlot ? previewBuild[pairedSlot] : undefined;

    if (
      isWristPreviewSlot(slot)
      && item.lore
      && pairedItem
      && itemIdentity(pairedItem) === itemIdentity(item)
    ) {
      setPreviewWarning("This LORE wrist item cannot be equipped in both wrist slots.");
      return;
    }

    setPreviewWarning("");
    setPreviewBuild((current) => ({
      ...current,
      [slot]: item,
    }));
  }

  return (
    <div className="velious-armor-page-shell">
      <section className="velious-armor-controls" aria-label="Velious class armor controls">
        <label>
          <span>Class</span>
          <select onChange={(event) => selectClass(event.target.value)} value={selectedClass}>
            {classOptions.map((classCode) => (
              <option key={classCode} value={classCode}>{classCode}</option>
            ))}
          </select>
        </label>
      </section>

      {selectedClass ? (
        <section className="velious-faction-summary" aria-label="Faction reward summary">
          {factionSummaries.map((summary) => (
            (() => {
              const totals = setTotals(armorIndex, summary.set);
              const metrics = metricLine([["AC", totals.ac], ["HP", totals.hp], ["Mana", totals.mana]]);
              return (
                <article className={`velious-faction-card ${armorSetClassNames[summary.set]}`} key={summary.set}>
                  <span>{summary.set}</span>
                  <h2>{summary.faction}</h2>
                  <small>{summary.label}</small>
                  {metrics ? <p className="velious-faction-metrics">{metrics}</p> : null}
                  {false ? <p className="velious-faction-primary">
                    AC {totals.ac} · HP {totals.hp} · Mana {totals.mana}
                  </p> : null}
                  <p>{totals.stats || "No main stats"}</p>
                  <p>{totals.resists || "No resists"}</p>
                  {totals.pieceCount < previewSlots.length ? (
                    <em>{totals.pieceCount}/{previewSlots.length} pieces found</em>
                  ) : null}
                </article>
              );
            })()
          ))}
        </section>
      ) : null}

      <div className="velious-armor-layout">
        <section className="velious-armor-comparison" aria-label="Velious armor comparison">
          <table>
            <thead>
              <tr>
                <th>Slot</th>
                {armorSets.map((armorSet) => (
                  <th className={armorSetClassNames[armorSet]} key={armorSet}>{armorSet}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewSlots.map((slot) => (
                <tr key={slot.id}>
                  <th>{slot.label}</th>
                  {armorSets.map((armorSet) => {
                    const item = armorIndex[slot.itemSlotId]?.[armorSet];
                    return (
                      <td className={armorSetClassNames[armorSet]} key={`${slot.id}-${armorSet}`} data-label={armorSet}>
                        <ArmorCell
                          item={item}
                          isSelected={previewBuild[slot.id] && item ? itemIdentity(previewBuild[slot.id] as ArmorItem) === itemIdentity(item) : false}
                          onSelect={() => item ? selectItem(slot.id, item) : undefined}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <aside className="velious-preview-panel" aria-label="Preview Build">
          <div className="velious-preview-header">
            <h2>Preview Build</h2>
            <button onClick={() => {
              setPreviewBuild({});
              setPreviewWarning("");
            }} type="button">Clear Preview</button>
          </div>

          {previewWarning ? <p className="velious-preview-warning">{previewWarning}</p> : null}

          <dl className="velious-preview-totals">
            {previewMetrics.filter(([, value]) => value > 0).map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>

          <div className="velious-preview-stat-grid">
            {totals.stats.length > 0 ? totals.stats.map(([key, value]) => (
              <span key={key}>{key} {value > 0 ? "+" : ""}{value}</span>
            )) : <p>No stats selected yet.</p>}
          </div>

          <div className="velious-preview-slots">
            {previewSlots.map((slot) => {
              const item = previewBuild[slot.id];
              return (
                <div className="velious-preview-slot" key={slot.id}>
                  <span>{slot.label}</span>
                  {item ? (
                    <strong>{item.name}</strong>
                  ) : (
                    <em>Nothing selected</em>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
