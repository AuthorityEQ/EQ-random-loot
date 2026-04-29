import type { ItemDetails } from "@/lib/search";

type ItemIconProps = {
  details?: ItemDetails;
};

type IconFields = {
  iconPath?: string | null;
  icon?: string | null;
  icon_url?: string | null;
};

export function ItemIcon({ details }: ItemIconProps) {
  const iconFields = details as (ItemDetails & IconFields) | undefined;
  const iconUrl = iconFields?.iconPath ?? iconFields?.icon_url ?? iconFields?.icon;

  if (!iconUrl) {
    return <span aria-hidden="true" className="loot-item-icon is-placeholder" />;
  }

  return <img alt="" aria-hidden="true" className="loot-item-icon" src={iconUrl} />;
}
