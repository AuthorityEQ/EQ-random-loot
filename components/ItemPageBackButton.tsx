"use client";

import { useRouter } from "next/navigation";

/**
 * Sticky "Back" button for the item detail page.
 * Uses router.back() so history-based navigation works seamlessly.
 */
export function ItemPageBackButton() {
  const router = useRouter();

  return (
    <button
      className="item-page-back-button"
      onClick={() => router.back()}
      type="button"
    >
      ← Back
    </button>
  );
}
