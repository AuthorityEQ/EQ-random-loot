import Link from "next/link";
import { mobToSlug } from "@/lib/mob-slug";

type BreadcrumbProps = {
  contentType: "Group Named" | "Raid Boss";
  bucketNumber?: number;
  bucketLevelRange?: string;
  raidTierName?: string;
  mobName: string;
};

/**
 * Server component — no "use client" directive.
 * Renders: Group Named / Bucket N (Level X-Y) / Mob Name
 * Or:       Raid Bosses / Tier Name / Mob Name
 */
export function Breadcrumb({
  contentType,
  bucketNumber,
  bucketLevelRange,
  raidTierName,
  mobName,
}: BreadcrumbProps) {
  const isGroupNamed = contentType === "Group Named";

  return (
    <nav className="mob-breadcrumb" aria-label="Breadcrumb">
      <ol className="mob-breadcrumb-list">
        <li>
          <Link href="/" className="mob-breadcrumb-link">
            {isGroupNamed ? "Group Named" : "Raid Bosses"}
          </Link>
        </li>

        <li className="mob-breadcrumb-sep" aria-hidden="true">/</li>

        {isGroupNamed && bucketNumber !== undefined ? (
          <li>
            <span className="mob-breadcrumb-current">
              Bucket {bucketNumber}
              {bucketLevelRange ? ` (${bucketLevelRange})` : ""}
            </span>
          </li>
        ) : raidTierName ? (
          <li>
            <Link href="/raids" className="mob-breadcrumb-link">
              {raidTierName}
            </Link>
          </li>
        ) : null}

        <li className="mob-breadcrumb-sep" aria-hidden="true">/</li>

        <li>
          <span
            className="mob-breadcrumb-current"
            aria-current="page"
          >
            {mobName}
          </span>
        </li>
      </ol>
    </nav>
  );
}
