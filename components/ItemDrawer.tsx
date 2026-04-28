"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { EqItemInspect } from "@/components/EqItemInspect";
import { useFavorites } from "@/components/FavoritesProvider";
import { bestZonesForBucket } from "@/lib/buckets";
import { getMissingFields } from "@/lib/item-status";
import type { Bucket, ItemDetails } from "@/lib/search";
import { StatusBadge } from "@/components/StatusBadge";

type ItemDrawerProps = {
  itemName: string;
  details?: ItemDetails;
  bucket: Bucket;
  itemBuckets?: Bucket[];
  expansion: string;
  contentType: string;
  onClose: () => void;
  onSelectZone: (zone: string) => void;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    return null;
  }

  return (
    <div className="detail-field" data-field={label.toLowerCase().replace(/\s+/g, "_")}>
      <dt>{label}</dt>
      <dd>
        <span className="editable-value">{value}</span>
      </dd>
    </div>
  );
}

function confidenceFor(details: ItemDetails) {
  return details.match_confidence ?? details.confidence;
}

export function ItemDrawer({
  itemName,
  details,
  bucket,
  itemBuckets,
  expansion,
  contentType,
  onClose,
  onSelectZone,
}: ItemDrawerProps) {
  const [copied, setCopied] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();
  const missingFields = useMemo(() => getMissingFields(details), [details]);
  const farmingLocations = useMemo(() => bestZonesForBucket(bucket), [bucket]);
  const allItemBuckets = itemBuckets?.length ? itemBuckets : [bucket];
  const confidence = details ? confidenceFor(details) : "not_found";
  const favorite = isFavorite(itemName, details);

  async function copyItemName() {
    await navigator.clipboard.writeText(itemName);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        aria-labelledby="item-drawer-title"
        aria-modal="true"
        className="item-drawer"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <button aria-label="Close item details" className="drawer-close" onClick={onClose}>
          x
        </button>

        <p className="drawer-kicker">Loot item</p>
        <h2 id="item-drawer-title">{itemName}</h2>
        <div className="drawer-actions">
          <button className="copy-button" onClick={copyItemName} type="button">
            {copied ? "Copied" : "Copy name"}
          </button>
          <button
            aria-pressed={favorite}
            className={favorite ? "favorite-button is-active" : "favorite-button"}
            onClick={() => toggleFavorite(itemName, details)}
            title={favorite ? "Remove from favorites" : "Add to favorites"}
            type="button"
          >
            <span aria-hidden="true">{favorite ? "★" : "☆"}</span>
            Favorite
          </button>
          <button className="save-button" disabled title="Editing is not wired up yet" type="button">
            Save
          </button>
        </div>

        {details ? (
          <>
            <div className="status-row">
              <StatusBadge details={details} />
              <span className="confidence">Confidence: {confidence}</span>
            </div>
            {confidence !== "exact_match" ? (
              <p className="review-warning">Item data may need review</p>
            ) : null}
            <EqItemInspect details={details} itemName={itemName} />

            <section className="review-panel">
              <h3>Review notes</h3>
              <Field label="Match notes" value={details.match_notes?.join(" ")} />
              <Field label="Warnings" value={details.parsing_warnings?.join(", ")} />
              <Field label="Missing fields" value={missingFields.join(", ")} />
            </section>

            {details.sources.length > 0 ? (
              <div className="sources">
                <h3>Sources</h3>
                {details.sources.map((source) => (
                  <a href={source.url} key={source.url} rel="noreferrer" target="_blank">
                    {source.name}
                  </a>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="missing-details">Item details not added yet.</p>
        )}

        <section className="context-panel">
          <h3>Bucket context</h3>
          <dl className="detail-grid">
            <Field label="Expansion" value={expansion} />
            <Field label="Content" value={contentType} />
              <Field label="Bucket" value={bucket.bucket} />
              <Field label="Level range" value={bucket.level_range} />
            <Field
              label="Zones"
              value={
                <span className="drawer-zone-list">
                  {bucket.zones.map((zone) => (
                    <button className="zone-link" key={zone} onClick={() => onSelectZone(zone)} type="button">
                      {zone}
                    </button>
                  ))}
                </span>
              }
            />
          </dl>

          <section className="farming-panel">
            <h3>Where to farm this item</h3>
            <p>Highlighted bucket, best farming zones, and possible mobs for this bucket</p>
            <div className="item-bucket-highlight-list">
              {allItemBuckets.map((itemBucket) => (
                <div className="item-bucket-highlight" key={itemBucket.bucket}>
                  <strong>Bucket {itemBucket.bucket}</strong>
                  <span>Levels {itemBucket.level_range}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="farming-panel is-highlighted">
            <h3>Best Farming Locations</h3>
            <p>Zones ranked by number of possible mobs in this bucket</p>
            <div className="farming-list">
              {farmingLocations.map(({ zone, mobs }) => (
                <div className="farming-zone is-highlighted" key={zone}>
                  <button className="zone-link farming-zone-name" onClick={() => onSelectZone(zone)} type="button">
                    {zone}
                  </button>
                  <span>{mobs.length} mobs in this bucket</span>
                  <ul>
                    {mobs.map((mob) => (
                      <li key={`${mob.name}-${mob.level}-${mob.zone}`}>
                        {mob.name}, level {mob.level}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <h4>Possible mobs</h4>
          <div className="drawer-mobs is-highlighted">
            {bucket.mobs.map((mob) => (
              <span key={`${mob.name}-${mob.level}-${mob.zone}`}>
                {mob.name}, level {mob.level},{" "}
                <button className="zone-link" onClick={() => onSelectZone(mob.zone)} type="button">
                  {mob.zone}
                </button>
              </span>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
