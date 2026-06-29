import type { Metadata } from "next";
import { PrivateRaidRoster } from "@/components/PrivateRaidRoster";
import "./raid-roster.css";

export const metadata: Metadata = {
  title: "Private Raid Roster",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PrivateRaidRosterPage() {
  return (
    <main className="private-raid-page">
      <PrivateRaidRoster />
    </main>
  );
}
