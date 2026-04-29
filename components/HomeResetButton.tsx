"use client";

import { useRouter } from "next/navigation";
import { useBucketDisplay } from "@/components/BucketDisplayProvider";

export function HomeResetButton() {
  const router = useRouter();
  const { setBucketed } = useBucketDisplay();

  function goHome() {
    setBucketed(true);
    window.dispatchEvent(new Event("frostreaver:reset-home"));
    router.push("/");
  }

  return (
    <button className="home-reset-button" onClick={goHome} type="button">
      <span aria-hidden="true">⌂</span>
      Home
    </button>
  );
}
