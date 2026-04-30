/**
 * ItemSlotFilter — horizontally scrollable slot-category filter with expandable sub-buttons.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INTEGRATION STEPS FOR app/page.tsx
 * (Apply these changes during the consolidation pass; do NOT edit page.tsx now.)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. IMPORT at the top of app/page.tsx:
 *
 *      import { ItemSlotFilter } from "@/components/ItemSlotFilter";
 *      import { bucketHasMatchingItems, itemMatchesSlots, type SlotKey } from "@/lib/slot-filter";
 *
 * 2. ADD STATE alongside the other useState declarations:
 *
 *      const [selectedSlots, setSelectedSlots] = useState<SlotKey[]>([]);
 *
 * 3. PLACE THE COMPONENT inside the .toolbar div, after the level-filter label:
 *
 *      <ItemSlotFilter selected={selectedSlots} onChange={setSelectedSlots} />
 *
 * 4. EXTEND filteredBuckets useMemo to respect slot selection.
 *    Replace the existing filteredBuckets useMemo with:
 *
 *      const filteredBuckets = useMemo(() => {
 *        return filterBuckets(expansionBuckets, "")
 *          .map((bucket) => {
 *            const visibleLoot = selectedSlots.length === 0
 *              ? bucket.loot_pool
 *              : bucket.loot_pool.filter((item) =>
 *                  itemMatchesSlots(item, itemDetails, selectedSlots)
 *                );
 *            return { bucket, visibleLoot };
 *          })
 *          .filter(({ bucket, visibleLoot }) =>
 *            visibleLoot.length > 0 &&
 *            (selectedSlots.length === 0 || bucketHasMatchingItems(bucket, itemDetails, selectedSlots))
 *          );
 *      }, [expansionBuckets, selectedSlots]);
 *
 * 5. DEPENDENCY ARRAY: add selectedSlots to filteredBuckets deps (already covered by
 *    the inline reference above — no extra action needed).
 *
 * 6. CLEAR SLOTS when zone or expansion filters change (optional UX polish):
 *    Inside the expansion toggle onClick and zone select onChange you may call
 *    setSelectedSlots([]) to reset slot selection when the data set changes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useState } from "react";
import {
  ALL_SLOT_KEYS,
  CATEGORY_LABELS,
  SLOT_CATEGORIES,
  SLOT_LABELS,
  type SlotCategory,
  type SlotKey,
} from "@/lib/slot-filter";

type ItemSlotFilterProps = {
  /** The currently selected slot keys (multi-select, ANY match). */
  selected: SlotKey[];
  /** Called with the full new selection whenever it changes. */
  onChange: (slots: SlotKey[]) => void;
};

const categoryOrder: SlotCategory[] = ["weapons", "armor", "accessories"];

export function ItemSlotFilter({ selected, onChange }: ItemSlotFilterProps) {
  // Which category panels are currently expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<SlotCategory>>(new Set());

  const selectedSet = new Set(selected);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function isCategoryFullyActive(category: SlotCategory): boolean {
    return SLOT_CATEGORIES[category].every((key) => selectedSet.has(key));
  }

  function isCategoryPartiallyActive(category: SlotCategory): boolean {
    return !isCategoryFullyActive(category) &&
      SLOT_CATEGORIES[category].some((key) => selectedSet.has(key));
  }

  function toggleCategory(category: SlotCategory) {
    const keys = SLOT_CATEGORIES[category];
    const allActive = isCategoryFullyActive(category);

    const nextSet = new Set(selectedSet);
    if (allActive) {
      keys.forEach((k) => nextSet.delete(k));
    } else {
      keys.forEach((k) => nextSet.add(k));
    }
    onChange([...nextSet].filter((k): k is SlotKey => ALL_SLOT_KEYS.has(k)));
  }

  function toggleSlot(key: SlotKey) {
    const nextSet = new Set(selectedSet);
    if (nextSet.has(key)) {
      nextSet.delete(key);
    } else {
      nextSet.add(key);
    }
    onChange([...nextSet].filter((k): k is SlotKey => ALL_SLOT_KEYS.has(k)));
  }

  function toggleCategoryExpanded(category: SlotCategory) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function clearAll() {
    onChange([]);
    setExpandedCategories(new Set());
  }

  const hasSelection = selected.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="slot-filter-group" aria-label="Item slot filter">
      <span>Item slot</span>
      <div className="slot-filter-scroll">
        {/* All Slots — clears the filter */}
        <button
          aria-pressed={!hasSelection}
          className={`slot-filter-button${!hasSelection ? " is-active" : ""}`}
          onClick={clearAll}
          type="button"
        >
          All slots
        </button>

        {/* Category + child buttons */}
        {categoryOrder.map((category) => {
          const isExpanded = expandedCategories.has(category);
          const isFullyActive = isCategoryFullyActive(category);
          const isPartial = isCategoryPartiallyActive(category);
          const childKeys = SLOT_CATEGORIES[category];

          return (
            <div className="slot-filter-category" key={category}>
              {/* Category parent button */}
              <button
                aria-expanded={isExpanded}
                aria-pressed={isFullyActive}
                className={[
                  "slot-filter-button",
                  "is-category",
                  isFullyActive ? "is-active" : null,
                  isPartial ? "is-partial" : null,
                ].filter(Boolean).join(" ")}
                onClick={() => {
                  // Primary click: toggle the category's slot selection
                  toggleCategory(category);
                  // Also expand if not already, so user can see the sub-slots
                  if (!isExpanded) {
                    toggleCategoryExpanded(category);
                  }
                }}
                type="button"
              >
                {CATEGORY_LABELS[category]}
                <span
                  
                  className="slot-filter-expand-icon"
                  onClick={(event) => {
                    // Secondary click on the chevron: only toggle expansion
                    event.stopPropagation();
                    toggleCategoryExpanded(category);
                  }}
                  role="button"
                  tabIndex={-1}
                  aria-label={`Toggle ${CATEGORY_LABELS[category]} slots visibility`}
                >
                  {isExpanded ? "▲" : "▼"}
                </span>
              </button>

              {/* Child sub-buttons */}
              {isExpanded ? (
                <div className="slot-filter-children" role="group" aria-label={`${CATEGORY_LABELS[category]} slots`}>
                  {childKeys.map((key) => (
                    <button
                      aria-pressed={selectedSet.has(key)}
                      className={`slot-filter-button slot-filter-button--child${selectedSet.has(key) ? " is-active" : ""}`}
                      key={key}
                      onClick={() => toggleSlot(key)}
                      type="button"
                    >
                      {SLOT_LABELS[key]}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
