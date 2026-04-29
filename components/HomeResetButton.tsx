"use client";

import { useRouter } from "next/navigation";

export function HomeResetButton() {
  const router = useRouter();

  function goHome() {
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
