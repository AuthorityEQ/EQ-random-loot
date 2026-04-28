"use client";

import { useState } from "react";
import type { RaidBoss } from "@/lib/raidTiers";

type RaidBossCardProps = {
  boss: RaidBoss;
};

export function RaidBossCard({ boss }: RaidBossCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <article className="raid-boss-card">
      <button
        aria-expanded={open}
        className="raid-boss-trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>
          <strong>{boss.name}</strong>
          <small>{boss.zone}</small>
        </span>
        <span>{boss.level > 0 ? `Level ${boss.level}` : "Zone"}</span>
      </button>

      {open ? (
        <div className="raid-boss-details">
          <dl className="raid-meta">
            <div>
              <dt>Zone</dt>
              <dd>{boss.zone}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>{boss.level > 0 ? boss.level : "N/A"}</dd>
            </div>
          </dl>
          {boss.notes ? <p className="raid-notes">{boss.notes}</p> : null}
        </div>
      ) : null}
    </article>
  );
}
