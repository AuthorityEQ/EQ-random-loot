"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EqItemInspect } from "@/components/EqItemInspect";
import { useFavorites } from "@/components/FavoritesProvider";
import { ShareToDiscordButton } from "@/components/ShareToDiscordButton";
import { bestZonesForBucket } from "@/lib/buckets";
import { itemToSlug } from "@/lib/item-slug";
import type { Bucket, ItemDetails } from "@/lib/search";

export type ItemDetailBodyProps = {
  itemName: string;
  details: ItemDetails | undefined;
  /** The primary bucket the item was opened from. */
  bucket?: Bucket;
  /** All buckets this item appears in (used for the bucket highlight list). */
  allBuckets: Bucket[];
  contentType?: string;
  showOpenPageAction?: boolean;
  /**
   * Called when the user clicks a zone button inside the body.
   * When undefined the zone button navigates to /?selectedZone=... instead.
   */
  onSelectZone?: (zone: string) => void;
};

export function ItemDetailBody({
  itemName,
  details,
  bucket,
  allBuckets,
  contentType,
  onSelectZone,
  showOpenPageAction = true,
}: ItemDetailBodyProps) {
  const [copied, setCopied] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();
  const router = useRouter();

  // Use the first bucket when no primary bucket is specified.
  const primaryBucket = bucket ?? allBuckets[0];
  const farmingLocations = useMemo(
    () =>
      primaryBucket
        ? bestZonesForBucket(primaryBucket, Number.POSITIVE_INFINITY)
        : [],
    [primaryBucket],
  );
  const favorite = isFavorite(itemName, details);
  const raidDropSources = useMemo(
    () =>
      contentType === "Raid Boss"
        ? allBuckets
            .map((itemBucket) => {
              const mobs = itemBucket.mobs.filter((mob) => mob.name);
              if (mobs.length === 0) return null;
              const zones = Array.from(new Set(mobs.map((mob) => mob.zone).filter(Boolean)));
              return {
                expansion: itemBucket.expansion || mobs[0].expansion,
                levelRange: itemBucket.level_range,
                mobNames: mobs.map((mob) => mob.name),
                raidTierName: itemBucket.raidTierName ?? mobs[0].source_bucket,
                zones,
              };
            })
            .filter((source): source is NonNullable<typeof source> => Boolean(source))
        : [],
    [allBuckets, contentType],
  );

  // Derive bucket label and drop zones for the Discord share message.
  const discordBucketLabel = primaryBucket
    ? `${primaryBucket.bucket} (${primaryBucket.level_range})`
    : undefined;

  const discordDropLocations = useMemo(() => {
    if (!primaryBucket) return undefined;
    const zones = Array.from(
      new Set(
        primaryBucket.mobs
          .filter((m) => m.loot.includes(itemName))
          .map((m) => m.zone),
      ),
    );
    if (zones.length > 0) return zones.slice(0, 4).join(", ");
    return primaryBucket.zones.slice(0, 4).join(", ");
  }, [primaryBucket, itemName]);

  async function copyItemName() {
    await navigator.clipboard.writeText(itemName);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function handleZoneClick(zone: string) {
    if (onSelectZone) {
      onSelectZone(zone);
    } else {
      router.push(`/?selectedZone=${encodeURIComponent(zone)}`);
    }
  }

  const itemSlug = itemToSlug(itemName);

  return (
    <div className="item-detail-body">
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
        {showOpenPageAction ? (
          <a
            className="open-page-button"
            href={`/item/${itemSlug}`}
            title="Open standalone detail page"
          >
            Open as page
          </a>
        ) : null}
        <ShareToDiscordButton
          bucketLabel={discordBucketLabel}
          dropLocations={discordDropLocations}
          itemName={itemName}
          itemSlug={itemSlug}
        />
        <button className="save-button" disabled title="Editing is not wired up yet" type="button">
          Save
        </button>
      </div>

      {details ? (
        <>
          <EqItemInspect details={details} itemName={itemName} />

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
        <p className="no-details">Item details not added yet.</p>
      )}

      {raidDropSources.length > 0 ? (
        <section className="farming-panel is-highlighted" id="raid-drops-from">
          <h3>Drops From</h3>
          <div className="raid-drop-source-list">
            {raidDropSources.map((source) => (
              <div
                className="raid-drop-source-row"
                key={`${source.expansion}-${source.raidTierName}-${source.levelRange}`}
              >
                <div className="raid-drop-source-heading">
                  <strong>{source.raidTierName}</strong>
                  <span>
                    {source.zones.join(", ")} · {source.expansion}
                    {source.levelRange && source.levelRange !== "N/A" ? ` · Level ${source.levelRange}` : ""}
                  </span>
                </div>
                <ul className="raid-drop-source-mobs">
                  {source.mobNames.map((mobName) => (
                    <li key={mobName}>{mobName}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : primaryBucket ? (
        <section className="farming-panel is-highlighted">
          <h3>Best Farming Locations</h3>
          <p>Zones ranked by number of possible mobs in this bucket</p>
          <div className="item-bucket-highlight-list">
            {allBuckets.map((itemBucket) => (
              <div
                className="item-bucket-highlight"
                key={`${itemBucket.expansion}-${itemBucket.bucket}`}
              >
                <strong>{itemBucket.expansion}</strong>
                <span>Levels {itemBucket.level_range}</span>
              </div>
            ))}
          </div>
          <div className="farming-list">
            {farmingLocations.map(({ zone, mobs }) => (
              <div className="farming-zone is-highlighted" key={zone}>
                <button
                  className="zone-link farming-zone-name"
                  onClick={() => handleZoneClick(zone)}
                  type="button"
                >
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
      ) : null}
    </div>
  );
}
