"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

type BonusType =
  | "Experience"
  | "AA"
  | "Coin"
  | "Loot"
  | "Rare"
  | "Skill"
  | "Respawn"
  | "Faction"
  | "None";

type Zone = {
  zoneName: string;
  expansion: string;
  reports: {
    bonus: BonusType;
    count: number;
    submissions: ReportSubmission[];
  }[];
};

type BonusStatus = "Unreported" | "Single Report" | "Likely" | "Confirmed" | "Disputed";
type FilterBonusType = Exclude<BonusType, "None">;
type BonusFilter = "All" | FilterBonusType;
type StatusFilter = "All" | "Reported" | "Unreported";
type ZoneWithStatus = Zone & { status: BonusStatus; totalReports: number };
type ZoneGroup = {
  key: string;
  label: string;
  zones: ZoneWithStatus[];
};
type ZoneOptionGroup = {
  expansion: string;
  zones: Zone[];
};
type ActiveUserReport = {
  zoneName: string;
  expansion: string;
  bonus: BonusType;
};

type ServerBonusReport = {
  id: string;
  zoneName: string;
  bonus: BonusType;
  discordUserId: string;
  discordUsername: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReportSubmission = Pick<
  ServerBonusReport,
  "id" | "bonus" | "discordUserId" | "discordUsername" | "createdAt" | "updatedAt"
>;

const reportBonusTypes: BonusType[] = [
  "Experience",
  "AA",
  "Coin",
  "Loot",
  "Rare",
  "Skill",
  "Respawn",
  "Faction",
  "None",
];

const filterBonusTypes: FilterBonusType[] = reportBonusTypes.filter((bonus): bonus is FilterBonusType => bonus !== "None");
const reportedBonusGroupOrder: BonusType[] = [
  "Experience",
  "AA",
  "Coin",
  "Loot",
  "Rare",
  "Skill",
  "Respawn",
  "Faction",
  "None",
];
const submissionBonusTypes: FilterBonusType[] = [...filterBonusTypes].sort((bonusA, bonusB) => bonusA.localeCompare(bonusB));
const managementBonusTypes: BonusType[] = [...reportBonusTypes].sort((bonusA, bonusB) => bonusA.localeCompare(bonusB));

const statusFilters: StatusFilter[] = [
  "All",
  "Reported",
  "Unreported",
];

const baseZones = [
  { zoneName: "Bastion of Thunder", expansion: "Planes of Power" },
  { zoneName: "Burning Woods", expansion: "Kunark" },
  { zoneName: "Everfrost Peaks", expansion: "Classic" },
  { zoneName: "Greater Faydark", expansion: "Classic" },
  { zoneName: "Kaesora", expansion: "Kunark" },
  { zoneName: "Karnor's Castle", expansion: "Kunark" },
  { zoneName: "Lair of the Splitpaw", expansion: "Classic" },
  { zoneName: "Lake of Ill Omen", expansion: "Kunark" },
  { zoneName: "Marus Seru", expansion: "Luclin" },
  { zoneName: "Najena", expansion: "Classic" },
  { zoneName: "North Ro", expansion: "Classic" },
  { zoneName: "Plane of Water", expansion: "Planes of Power" },
  { zoneName: "Thurgadin", expansion: "Velious" },
  { zoneName: "Umbral Plains", expansion: "Luclin" },
  { zoneName: "Wakening Land", expansion: "Velious" },
  { zoneName: "West Karana", expansion: "Classic" },
  { zoneName: "Acrylia Caverns", expansion: "Luclin" },
  { zoneName: "Maiden's Eye", expansion: "Luclin" },
  { zoneName: "Plane of Disease", expansion: "Planes of Power" },
  { zoneName: "Plane of Fire", expansion: "Planes of Power" },
  { zoneName: "Butcherblock Mountains", expansion: "Classic" },
  { zoneName: "Crushbone", expansion: "Classic" },
  { zoneName: "Eastern Wastes", expansion: "Velious" },
  { zoneName: "Gorge of King Xorbb", expansion: "Classic" },
  { zoneName: "Gulf of Gunthak", expansion: "Legacy of Ykesha" },
  { zoneName: "Lower Guk", expansion: "Classic" },
  { zoneName: "Paludal Caverns", expansion: "Luclin" },
  { zoneName: "Plane of Mischief", expansion: "Velious" },
  { zoneName: "Rathe Mountains", expansion: "Classic" },
  { zoneName: "Ssraeshza Temple", expansion: "Luclin" },
  { zoneName: "Upper Guk", expansion: "Classic" },
  { zoneName: "Velketor's Labyrinth", expansion: "Velious" },
  { zoneName: "Cobalt Scar", expansion: "Velious" },
  { zoneName: "Lavastorm Mountains", expansion: "Classic" },
  { zoneName: "Skyshrine", expansion: "Velious" },
  { zoneName: "The Warrens", expansion: "Velious" },
  { zoneName: "Caverns of Exile", expansion: "Classic" },
  { zoneName: "City of Mist", expansion: "Kunark" },
  { zoneName: "Crypt of Decay", expansion: "Planes of Power" },
  { zoneName: "Dreadlands", expansion: "Kunark" },
  { zoneName: "Firiona Vie", expansion: "Kunark" },
  { zoneName: "Fungus Grove", expansion: "Luclin" },
  { zoneName: "Grieg's End", expansion: "Luclin" },
  { zoneName: "Old Sebilis", expansion: "Kunark" },
  { zoneName: "South Karana", expansion: "Classic" },
  { zoneName: "Steamfont Mountains", expansion: "Classic" },
  { zoneName: "The Overthere", expansion: "Kunark" },
  { zoneName: "Torgiran Mines", expansion: "Legacy of Ykesha" },
  { zoneName: "Tower of Frozen Shadow", expansion: "Velious" },
  { zoneName: "Iceclad Ocean", expansion: "Velious" },
  { zoneName: "Scarlet Desert", expansion: "Luclin" },
  { zoneName: "Chardok", expansion: "Kunark" },
  { zoneName: "Grimling Forest", expansion: "Luclin" },
  { zoneName: "Plane of Valor", expansion: "Planes of Power" },
  { zoneName: "South Ro", expansion: "Classic" },
  { zoneName: "Nagafen's Lair (SolB)", expansion: "Classic" },
  { zoneName: "Ak'Anon", expansion: "Classic" },
  { zoneName: "Blackburrow", expansion: "Classic" },
  { zoneName: "Castle Mistmoore", expansion: "Classic" },
  { zoneName: "Commonlands", expansion: "Classic" },
  { zoneName: "Dawnshroud Peaks", expansion: "Luclin" },
  { zoneName: "Dulak's Harbor", expansion: "Legacy of Ykesha" },
  { zoneName: "Echo Caverns", expansion: "Luclin" },
  { zoneName: "Erudin", expansion: "Classic" },
  { zoneName: "Felwithe", expansion: "Classic" },
  { zoneName: "Freeport", expansion: "Classic" },
  { zoneName: "Great Divide", expansion: "Velious" },
  { zoneName: "Halas", expansion: "Classic" },
  { zoneName: "Hate's Fury, The Scorned Maiden", expansion: "Legacy of Ykesha" },
  { zoneName: "Icewell Keep", expansion: "Velious" },
  { zoneName: "Kael Drakkal", expansion: "Velious" },
  { zoneName: "Kurn's Tower", expansion: "Kunark" },
  { zoneName: "Mines of Nurga", expansion: "Kunark" },
  { zoneName: "Mons Letalis", expansion: "Luclin" },
  { zoneName: "Neriak", expansion: "Classic" },
  { zoneName: "North Karana", expansion: "Classic" },
  { zoneName: "Oggok", expansion: "Classic" },
  { zoneName: "Plane of Time B", expansion: "Planes of Power" },
  { zoneName: "Qeynos", expansion: "Classic" },
  { zoneName: "Rivervale", expansion: "Classic" },
  { zoneName: "Shadow Haven", expansion: "Luclin" },
  { zoneName: "Siren's Grotto", expansion: "Velious" },
  { zoneName: "Solusek's Eye", expansion: "Classic" },
  { zoneName: "Surefall Glade", expansion: "Classic" },
  { zoneName: "The Bazaar", expansion: "Luclin" },
  { zoneName: "The Feerrott", expansion: "Classic" },
  { zoneName: "The Hole", expansion: "Kunark" },
  { zoneName: "Timorous Deep", expansion: "Kunark" },
  { zoneName: "Trakanon's Teeth", expansion: "Kunark" },
  { zoneName: "Warsliks Wood", expansion: "Kunark" },
  { zoneName: "Befallen", expansion: "Classic" },
  { zoneName: "Cabilis", expansion: "Kunark" },
  { zoneName: "Clan Runnyeye", expansion: "Classic" },
  { zoneName: "Crypt of Nadox", expansion: "Legacy of Ykesha" },
  { zoneName: "Dragon Necropolis", expansion: "Velious" },
  { zoneName: "East Karana", expansion: "Classic" },
  { zoneName: "Emerald Jungle", expansion: "Kunark" },
  { zoneName: "Erudin Palace", expansion: "Classic" },
  { zoneName: "Field of Bone", expansion: "Kunark" },
  { zoneName: "Frontier Mountains", expansion: "Kunark" },
  { zoneName: "Grobb", expansion: "Classic" },
  { zoneName: "Hate's Fury, Setting Sail", expansion: "Legacy of Ykesha" },
  { zoneName: "Howling Stones", expansion: "Kunark" },
  { zoneName: "Innothule Swamp", expansion: "Classic" },
  { zoneName: "Kaladim", expansion: "Classic" },
  { zoneName: "Lesser Faydark", expansion: "Classic" },
  { zoneName: "Misty Thicket", expansion: "Classic" },
  { zoneName: "Nektulos Forest", expansion: "Classic" },
  { zoneName: "Netherbian Lair", expansion: "Luclin" },
  { zoneName: "Ocean of Tears", expansion: "Classic" },
  { zoneName: "Paineel", expansion: "Classic" },
  { zoneName: "Plane of War", expansion: "Planes of Power" },
  { zoneName: "Qeynos Hills", expansion: "Classic" },
  { zoneName: "Shadeweaver's Thicket", expansion: "Luclin" },
  { zoneName: "Shar Vahl", expansion: "Luclin" },
  { zoneName: "Skyfire Mountains", expansion: "Kunark" },
  { zoneName: "Stonebrunt Mountains", expansion: "Velious" },
  { zoneName: "Temple of Droga", expansion: "Kunark" },
  { zoneName: "The Deep", expansion: "Luclin" },
  { zoneName: "The Grey", expansion: "Luclin" },
  { zoneName: "The Nexus", expansion: "Luclin" },
  { zoneName: "Toxxulia Forest", expansion: "Classic" },
  { zoneName: "Twilight Sea", expansion: "Luclin" },
  { zoneName: "Akheva Ruins", expansion: "Luclin" },
  { zoneName: "Dagnor's Cauldron", expansion: "Classic" },
  { zoneName: "Erud's Crossing", expansion: "Classic" },
  { zoneName: "Freeport Sewers", expansion: "Classic" },
  { zoneName: "High Keep", expansion: "Classic" },
  { zoneName: "Hollowshade Moor", expansion: "Luclin" },
  { zoneName: "Katta Castellum", expansion: "Luclin" },
  { zoneName: "Kithicor Forest", expansion: "Classic" },
  { zoneName: "Lake Rathetear", expansion: "Classic" },
  { zoneName: "Plane of Air", expansion: "Planes of Power" },
  { zoneName: "Plane of Fear", expansion: "Classic" },
  { zoneName: "Plane of Hate", expansion: "Classic" },
  { zoneName: "Plane of Justice", expansion: "Planes of Power" },
  { zoneName: "Plane of Sky", expansion: "Classic" },
  { zoneName: "Plane of Tactics", expansion: "Planes of Power" },
  { zoneName: "Plane of Torment", expansion: "Planes of Power" },
  { zoneName: "Ragrax, Stronghold of the Twelve", expansion: "Planes of Power" },
  { zoneName: "Sanctus Seru", expansion: "Luclin" },
  { zoneName: "Solusek Ro's Tower", expansion: "Planes of Power" },
  { zoneName: "Temple of Cazic-Thule", expansion: "Classic" },
  { zoneName: "Temple of Solusek Ro", expansion: "Classic" },
  { zoneName: "Tenebrous Mountains", expansion: "Luclin" },
  { zoneName: "Vex Thal", expansion: "Luclin" },
  { zoneName: "Crystal Caverns", expansion: "Velious" },
  { zoneName: "Dalnir", expansion: "Kunark" },
  { zoneName: "Estate of Unrest", expansion: "Classic" },
  { zoneName: "Halls of Honor", expansion: "Planes of Power" },
  { zoneName: "Highpass Hold", expansion: "Classic" },
  { zoneName: "Jaggedpine Forest", expansion: "Luclin" },
  { zoneName: "Kedge Keep", expansion: "Classic" },
  { zoneName: "Lair of Terris Thule", expansion: "Planes of Power" },
  { zoneName: "Permafrost Keep", expansion: "Classic" },
  { zoneName: "Plane of Earth", expansion: "Planes of Power" },
  { zoneName: "Plane of Growth", expansion: "Velious" },
  { zoneName: "Plane of Innovation", expansion: "Planes of Power" },
  { zoneName: "Plane of Nightmare", expansion: "Planes of Power" },
  { zoneName: "Plane of Storm", expansion: "Planes of Power" },
  { zoneName: "Plane of Time A", expansion: "Planes of Power" },
  { zoneName: "Qeynos Catacombs", expansion: "Classic" },
  { zoneName: "Sleeper's Tomb", expansion: "Velious" },
  { zoneName: "Swamp of No Hope", expansion: "Kunark" },
  { zoneName: "Temple of Marr", expansion: "Planes of Power" },
  { zoneName: "Temple of Veeshan", expansion: "Velious" },
  { zoneName: "Veeshan's Peak", expansion: "Kunark" },
  { zoneName: "Western Wastes", expansion: "Velious" },
] satisfies Array<Omit<Zone, "reports">>;

const zones: Zone[] = baseZones.map((zone) => ({ ...zone, reports: [] }));

function getExpansionSortValue(expansion: string) {
  const order = [
    "Classic",
    "Kunark",
    "Velious",
    "Luclin",
    "Planes of Power",
    "Legacy of Ykesha",
    "Unknown",
  ];
  const index = order.indexOf(expansion);
  return index === -1 ? order.length : index;
}

function getBonusSortValue(bonus: BonusType) {
  const index = reportedBonusGroupOrder.indexOf(bonus);
  return index === -1 ? reportedBonusGroupOrder.length : index;
}

function getLeadingReport(zone: Zone) {
  return zone.reports
    .slice()
    .sort((a, b) => b.count - a.count || a.bonus.localeCompare(b.bonus))[0];
}

function getZoneStatus(zone: Zone): BonusStatus {
  const reports = zone.reports.filter((report) => report.count > 0);
  const totalReports = reports.reduce((sum, report) => sum + report.count, 0);

  if (totalReports === 0) return "Unreported";
  if (reports.length > 1) return "Disputed";
  if (totalReports === 1) return "Single Report";
  if (totalReports === 2) return "Likely";
  return "Confirmed";
}

function getTotalReports(zone: Zone) {
  return zone.reports.reduce((sum, report) => sum + report.count, 0);
}

function getReportedSortValue(status: BonusStatus) {
  const order: Record<BonusStatus, number> = {
    Confirmed: 0,
    Likely: 1,
    "Single Report": 2,
    Disputed: 3,
    Unreported: 4,
  };
  return order[status];
}

function getExpansionToneClass(expansion: string) {
  const toneByExpansion: Record<string, string> = {
    Classic: "expansion-tone-classic",
    Kunark: "expansion-tone-kunark",
    Velious: "expansion-tone-velious",
    Luclin: "expansion-tone-luclin",
    "Planes of Power": "bonus-expansion-tone-pop",
    "Legacy of Ykesha": "bonus-expansion-tone-yks",
    Unknown: "bonus-expansion-tone-unknown",
  };
  return toneByExpansion[expansion] ?? "bonus-expansion-tone-unknown";
}

function reportMatchesFilter(zone: Zone, selectedBonus: BonusFilter) {
  if (selectedBonus === "All") return true;
  return zone.reports.some((report) => report.bonus === selectedBonus && report.count > 0);
}

function formatBonusLabel(bonus: BonusFilter | BonusType) {
  return bonus;
}

function formatBonusGroupLabel(bonus: BonusType) {
  return bonus === "None" ? "No Bonus" : `${formatBonusLabel(bonus)} Bonus`;
}

function getBonusToneClass(bonus: BonusType) {
  return bonus === "None" ? "is-none-bonus" : null;
}

function groupUnreportedZonesByExpansion(zones: ZoneWithStatus[]): ZoneGroup[] {
  const groups = new Map<string, ZoneWithStatus[]>();
  for (const zone of zones) {
    const expansion = zone.expansion || "Unknown";
    const groupZones = groups.get(expansion) ?? [];
    groupZones.push(zone);
    groups.set(expansion, groupZones);
  }

  return Array.from(groups.entries())
    .sort(([expansionA], [expansionB]) =>
      getExpansionSortValue(expansionA) - getExpansionSortValue(expansionB)
      || expansionA.localeCompare(expansionB)
    )
    .map(([expansion, groupZones]) => ({
      key: expansion,
      label: expansion,
      zones: groupZones.sort((zoneA, zoneB) => zoneA.zoneName.localeCompare(zoneB.zoneName)),
    }));
}

function groupZoneOptionsByExpansion(zoneOptions: Zone[]): ZoneOptionGroup[] {
  const groups = new Map<string, Zone[]>();
  for (const zone of zoneOptions) {
    const expansion = zone.expansion || "Unknown";
    const groupZones = groups.get(expansion) ?? [];
    groupZones.push(zone);
    groups.set(expansion, groupZones);
  }

  return Array.from(groups.entries())
    .sort(([expansionA], [expansionB]) =>
      getExpansionSortValue(expansionA) - getExpansionSortValue(expansionB)
      || expansionA.localeCompare(expansionB)
    )
    .map(([expansion, groupZones]) => ({
      expansion,
      zones: groupZones.sort((zoneA, zoneB) => zoneA.zoneName.localeCompare(zoneB.zoneName)),
    }));
}

function getDefaultSubmissionZoneName() {
  return groupZoneOptionsByExpansion(zones)[0]?.zones[0]?.zoneName ?? "";
}

function groupReportedZonesByBonus(zones: ZoneWithStatus[]): ZoneGroup[] {
  const groups = new Map<BonusType, ZoneWithStatus[]>();
  for (const zone of zones) {
    const leadingBonus = getLeadingReport(zone)?.bonus ?? "None";
    const groupZones = groups.get(leadingBonus) ?? [];
    groupZones.push(zone);
    groups.set(leadingBonus, groupZones);
  }

  return Array.from(groups.entries())
    .sort(([bonusA], [bonusB]) =>
      getBonusSortValue(bonusA) - getBonusSortValue(bonusB)
      || bonusA.localeCompare(bonusB)
    )
    .map(([bonus, groupZones]) => ({
      key: bonus,
      label: formatBonusGroupLabel(bonus),
      zones: groupZones.sort((zoneA, zoneB) => zoneA.zoneName.localeCompare(zoneB.zoneName)),
    }));
}

function BonusIcon({ bonus }: { bonus: BonusType }) {
  if (bonus === "Experience") {
    return <span className="bonus-icon bonus-icon-xp" aria-label="Experience">XP</span>;
  }

  if (bonus === "AA") {
    return <span className="bonus-icon bonus-icon-xp" aria-label="AA">AA</span>;
  }

  if (bonus === "Coin") {
    return (
      <span className="bonus-icon bonus-icon-coin" aria-label="Coin">
        <img
          alt=""
          aria-hidden="true"
          className="bonus-coin-pill-image object-contain drop-shadow-[0_0_12px_rgba(180,200,255,0.35)] opacity-90"
          src="/icons/ppcoin.png"
        />
      </span>
    );
  }

  if (bonus === "None") {
    return <span className="bonus-icon bonus-icon-none" aria-label="None">None</span>;
  }

  if (bonus === "Skill") {
    return (
      <span className="bonus-icon bonus-icon-skill" aria-label="Skill">
        <img
          alt=""
          aria-hidden="true"
          className="bonus-skill-pill-image"
          src="/skillups.png"
        />
      </span>
    );
  }

  if (bonus === "Loot") {
    return (
      <span className="bonus-icon bonus-icon-loot" aria-label="Loot">
        <img
          alt=""
          aria-hidden="true"
          className="bonus-loot-pill-image"
          src="/lootbonus.png"
        />
      </span>
    );
  }

  const icons: Record<Exclude<BonusType, "Experience" | "AA" | "Coin" | "Loot" | "Skill" | "None">, string> = {
    Rare: "⭐",
    Respawn: "⏱️",
    Faction: "🏛️",
  };

  return <span className="bonus-icon" aria-hidden="true">{icons[bonus]}</span>;
}

function formatReporterName(submission: ReportSubmission) {
  return submission.discordUsername ?? submission.discordUserId;
}

function formatReportTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function LargeBonusIcon({ bonus }: { bonus: BonusType }) {
  if (bonus === "Experience" || bonus === "AA") {
    return (
      <span aria-hidden="true" className="bonus-large-icon is-text-mark">
        {bonus === "Experience" ? "XP" : "AA"}
      </span>
    );
  }

  if (bonus === "Coin") {
    return (
      <span aria-hidden="true" className="bonus-large-icon is-coin-mark">
        <img
          alt=""
          className="bonus-coin-image w-12 h-12 object-contain drop-shadow-[0_0_12px_rgba(180,200,255,0.35)] opacity-90"
          src="/icons/ppcoin.png"
        />
      </span>
    );
  }

  if (bonus === "Skill") {
    return (
      <span aria-hidden="true" className="bonus-large-icon is-skill-mark">
        <img
          alt=""
          className="bonus-skill-large-image"
          src="/skillups.png"
        />
      </span>
    );
  }

  if (bonus === "Loot") {
    return (
      <span aria-hidden="true" className="bonus-large-icon is-loot-mark">
        <img
          alt=""
          className="bonus-loot-large-image"
          src="/lootbonus.png"
        />
      </span>
    );
  }

  if (bonus === "None") {
    return (
      <span aria-hidden="true" className="bonus-large-icon is-none-mark">
        None
      </span>
    );
  }

  const emojiMarks: Record<Exclude<BonusType, "Experience" | "AA" | "Coin" | "Loot" | "Skill" | "None">, string> = {
    Rare: "⭐",
    Respawn: "⏱️",
    Faction: "🏛️",
  };

  return (
    <span aria-hidden="true" className="bonus-large-icon">
      {emojiMarks[bonus]}
    </span>
  );
}

function applyServerReports(zone: Zone, reports: ServerBonusReport[]): Zone {
  const reportsByBonus = new Map<BonusType, Zone["reports"][number]>();

  for (const report of reports) {
    if (report.zoneName !== zone.zoneName) continue;

    const currentReport = reportsByBonus.get(report.bonus);
    reportsByBonus.set(report.bonus, {
      bonus: report.bonus,
      count: (currentReport?.count ?? 0) + 1,
      submissions: [
        ...(currentReport?.submissions ?? []),
        {
          id: report.id,
          bonus: report.bonus,
          discordUserId: report.discordUserId,
          discordUsername: report.discordUsername,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
        },
      ],
    });
  }

  return {
    ...zone,
    reports: Array.from(reportsByBonus.values()),
  };
}

export function BonusTrackerClient() {
  const { data: session, status: authStatus } = useSession();
  const [query, setQuery] = useState("");
  const [selectedBonus, setSelectedBonus] = useState<BonusFilter>("All");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("All");
  const [openReportDetailsZone, setOpenReportDetailsZone] = useState<string | null>(null);
  const [submitZoneName, setSubmitZoneName] = useState(getDefaultSubmissionZoneName);
  const [submitBonus, setSubmitBonus] = useState<FilterBonusType>("Experience");
  const [activeReportDrafts, setActiveReportDrafts] = useState<Record<string, BonusType | undefined>>({});
  const [serverReports, setServerReports] = useState<ServerBonusReport[]>([]);
  const [userReports, setUserReports] = useState<Record<string, BonusType | undefined>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isModeratingReport, setIsModeratingReport] = useState(false);
  const [showUnreportedZones, setShowUnreportedZones] = useState(true);
  const isLoggedIn = authStatus === "authenticated" && Boolean(session?.user?.discordUserId);

  const expansionOptions = useMemo(() => {
    return Array.from(new Set(zones.map((zone) => zone.expansion))).sort((a, b) => {
      return getExpansionSortValue(a) - getExpansionSortValue(b) || a.localeCompare(b);
    });
  }, []);
  const submissionZoneGroups = useMemo(() => groupZoneOptionsByExpansion(zones), []);
  const [selectedExpansions, setSelectedExpansions] = useState<Set<string>>(() => new Set(expansionOptions));
  const selectedExpansionSet = useMemo(() => selectedExpansions, [selectedExpansions]);
  const allExpansionsSelected = selectedExpansionSet.size === expansionOptions.length;

  const normalizedQuery = query.trim().toLowerCase();
  const reportedZones = useMemo(() => {
    return zones.map((zone) => applyServerReports(zone, serverReports));
  }, [serverReports]);
  const activeUserReports = useMemo<ActiveUserReport[]>(() => {
    const zoneByName = new Map(zones.map((zone) => [zone.zoneName, zone]));
    return Object.entries(userReports)
      .map(([zoneName, bonus]) => {
        if (!bonus) return null;
        const zone = zoneByName.get(zoneName);
        return {
          zoneName,
          expansion: zone?.expansion ?? "Unknown",
          bonus,
        };
      })
      .filter((report): report is ActiveUserReport => Boolean(report))
      .sort((reportA, reportB) =>
        getExpansionSortValue(reportA.expansion) - getExpansionSortValue(reportB.expansion)
        || reportA.zoneName.localeCompare(reportB.zoneName)
      );
  }, [userReports]);

  useEffect(() => {
    let isCancelled = false;

    async function loadReports() {
      const response = await fetch("/api/bonus/reports", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as {
        reports?: ServerBonusReport[];
        currentUserReports?: Record<string, BonusType | undefined>;
        isAdmin?: boolean;
      };
      if (isCancelled) return;
      setServerReports(Array.isArray(payload.reports) ? payload.reports : []);
      setUserReports(payload.currentUserReports ?? {});
      setIsAdmin(Boolean(payload.isAdmin));
    }

    loadReports();
    return () => {
      isCancelled = true;
    };
  }, [authStatus]);

  useEffect(() => {
    setActiveReportDrafts((currentDrafts) => {
      const nextDrafts: Record<string, BonusType | undefined> = {};
      for (const report of activeUserReports) {
        nextDrafts[report.zoneName] = currentDrafts[report.zoneName]
          ?? report.bonus;
      }
      return nextDrafts;
    });
  }, [activeUserReports]);

  const visibleZones = useMemo<ZoneWithStatus[]>(() => {
    return reportedZones.map((zone) => ({
      ...zone,
      status: getZoneStatus(zone),
      totalReports: getTotalReports(zone),
    })).filter((zone) => {
      const searchMatches = zone.zoneName.toLowerCase().includes(normalizedQuery);
      const expansionMatches = selectedExpansionSet.has(zone.expansion);
      const statusMatches = selectedStatus === "All"
        || (selectedStatus === "Reported" && zone.totalReports > 0)
        || (selectedStatus === "Unreported" && zone.totalReports === 0);
      return searchMatches && expansionMatches && statusMatches && reportMatchesFilter(zone, selectedBonus);
    });
  }, [normalizedQuery, reportedZones, selectedBonus, selectedExpansionSet, selectedStatus]);

  const visibleReportedZones = useMemo(() => {
    return visibleZones
      .filter((zone) => zone.totalReports > 0)
      .sort((a, b) =>
        getReportedSortValue(a.status) - getReportedSortValue(b.status)
        || a.zoneName.localeCompare(b.zoneName)
      );
  }, [visibleZones]);

  const visibleUnreportedZones = useMemo(() => {
    return visibleZones
      .filter((zone) => zone.totalReports === 0)
      .sort((a, b) =>
        getExpansionSortValue(a.expansion) - getExpansionSortValue(b.expansion)
        || a.zoneName.localeCompare(b.zoneName)
      );
  }, [visibleZones]);

  const reportedZoneGroups = useMemo(() => groupReportedZonesByBonus(visibleReportedZones), [visibleReportedZones]);
  const unreportedZoneGroups = useMemo(() => groupUnreportedZonesByExpansion(visibleUnreportedZones), [visibleUnreportedZones]);

  const activeFilters = [
    normalizedQuery ? `search ${query.trim()}` : null,
    !allExpansionsSelected
      ? `expansion ${expansionOptions.filter((expansion) => selectedExpansionSet.has(expansion)).join(", ")}`
      : null,
    selectedBonus !== "All" ? `bonus ${formatBonusLabel(selectedBonus)}` : null,
    selectedStatus !== "All" ? `reporting ${selectedStatus}` : null,
  ].filter(Boolean);
  const emptyMessage = activeFilters.length > 0
    ? `No zones match the active filters: ${activeFilters.join(", ")}.`
    : "No zones are available yet.";

  async function saveReport(zoneName: string, bonus: BonusType, successMessage: string) {
    if (!zoneName || !bonus) {
      setReportMessage("Choose a zone and bonus before submitting.");
      return;
    }

    setIsSubmittingReport(true);
    setReportMessage("");

    try {
      const response = await fetch("/api/bonus/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneName, bonus }),
      });
      const payload = await response.json().catch(() => ({})) as {
        reports?: ServerBonusReport[];
        currentUserReports?: Record<string, BonusType | undefined>;
        isAdmin?: boolean;
        error?: string;
        message?: string;
        remainingSeconds?: number;
      };

      if (response.ok) {
        setServerReports(Array.isArray(payload.reports) ? payload.reports : []);
        setUserReports(payload.currentUserReports ?? {});
        setIsAdmin(Boolean(payload.isAdmin));
        setReportMessage(successMessage);
        return;
      }

      if (response.status === 429 && typeof payload.remainingSeconds === "number") {
        setReportMessage(`You can submit another zone report in ${payload.remainingSeconds} seconds.`);
      } else if (response.status === 403 && payload.error === "USER_BANNED") {
        setReportMessage("You cannot submit bonus reports.");
      } else if (response.status === 401) {
        setReportMessage("Sign in with Discord to submit reports.");
      } else if (payload.error === "STORAGE_NOT_CONFIGURED") {
        setReportMessage(payload.message ?? "Report storage is not configured for production yet.");
      } else if (payload.error === "DATABASE_ERROR") {
        setReportMessage(payload.message ?? "Report storage is temporarily unavailable.");
      } else {
        setReportMessage("Could not save that report. Please try again.");
      }
    } finally {
      setIsSubmittingReport(false);
    }
  }

  async function submitReport() {
    await saveReport(submitZoneName, submitBonus, `Report saved for ${submitZoneName}.`);
  }

  async function changeUserReport(zoneName: string) {
    const nextBonus = activeReportDrafts[zoneName] ?? userReports[zoneName];
    if (!nextBonus) {
      setReportMessage("Choose a replacement bonus before saving.");
      return;
    }
    await saveReport(zoneName, nextBonus, `Report updated for ${zoneName}.`);
  }

  async function removeUserReport(zoneName: string) {
    setIsSubmittingReport(true);
    setReportMessage("");

    try {
      const response = await fetch("/api/bonus/reports", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneName }),
      });
      const payload = await response.json().catch(() => ({})) as {
        reports?: ServerBonusReport[];
        currentUserReports?: Record<string, BonusType | undefined>;
        isAdmin?: boolean;
        error?: string;
        message?: string;
      };

      if (response.ok) {
        setServerReports(Array.isArray(payload.reports) ? payload.reports : []);
        setUserReports(payload.currentUserReports ?? {});
        setIsAdmin(Boolean(payload.isAdmin));
        setReportMessage(`Report removed for ${zoneName}.`);
        return;
      }

      if (response.status === 401) {
        setReportMessage("Sign in with Discord to remove reports.");
      } else if (payload.error === "REPORT_NOT_FOUND") {
        setReportMessage("That report was already removed.");
      } else if (payload.error === "STORAGE_NOT_CONFIGURED") {
        setReportMessage(payload.message ?? "Report storage is not configured for production yet.");
      } else if (payload.error === "DATABASE_ERROR") {
        setReportMessage(payload.message ?? "Report storage is temporarily unavailable.");
      } else {
        setReportMessage("Could not remove that report. Please try again.");
      }
    } finally {
      setIsSubmittingReport(false);
    }
  }

  async function deleteReport(reportId: string) {
    if (!isAdmin) return;
    setIsModeratingReport(true);
    setReportMessage("");

    try {
      const response = await fetch(`/api/bonus/reports?id=${encodeURIComponent(reportId)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({})) as {
        reports?: ServerBonusReport[];
        currentUserReports?: Record<string, BonusType | undefined>;
        isAdmin?: boolean;
        error?: string;
      };

      if (response.ok) {
        setServerReports(Array.isArray(payload.reports) ? payload.reports : []);
        setUserReports(payload.currentUserReports ?? {});
        setIsAdmin(Boolean(payload.isAdmin));
        setReportMessage("Report deleted.");
        return;
      }

      setReportMessage(payload.error === "ADMIN_REQUIRED"
        ? "Only the configured admin can delete reports."
        : "Could not delete that report.");
    } finally {
      setIsModeratingReport(false);
    }
  }

  async function banUser(discordUserId: string) {
    if (!isAdmin) return;
    setIsModeratingReport(true);
    setReportMessage("");

    try {
      const response = await fetch("/api/bonus/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "banUser", discordUserId }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };

      setReportMessage(response.ok
        ? "User banned from future reports."
        : payload.error === "ADMIN_REQUIRED"
          ? "Only the configured admin can ban users."
          : "Could not ban that user.");
    } finally {
      setIsModeratingReport(false);
    }
  }

  function selectStatusFilter(status: StatusFilter) {
    setSelectedStatus(status);
    if (status === "Unreported") {
      setSelectedBonus("All");
    }
  }

  function selectAllExpansions() {
    setSelectedExpansions(new Set(expansionOptions));
  }

  function toggleExpansion(expansion: string) {
    setSelectedExpansions((current) => {
      const next = new Set(current);
      if (next.has(expansion)) {
        next.delete(expansion);
      } else {
        next.add(expansion);
      }
      if (next.size === 0) return current;
      return new Set(expansionOptions.filter((option) => next.has(option)));
    });
  }

  function renderZoneCard(zone: ZoneWithStatus, mode: "reported" | "unreported") {
    const leadingReport = getLeadingReport(zone);
    const isReported = mode === "reported";
    const userReport = userReports[zone.zoneName];
    const isDetailsOpen = openReportDetailsZone === zone.zoneName;
    const reportSubmissions = zone.reports.flatMap((report) => report.submissions);

    return (
      <article
        className={[
          "bonus-zone-card",
          isReported ? "is-reported" : "is-unreported",
          getExpansionToneClass(zone.expansion),
        ].join(" ")}
        key={zone.zoneName}
      >
        <div className="bonus-zone-card-main">
          <div>
            <div className="bonus-zone-title-row">
              <h2>{zone.zoneName}</h2>
              <span className={`bonus-expansion-label ${getExpansionToneClass(zone.expansion)}`}>
                {zone.expansion}
              </span>
            </div>
            {isReported ? (
              <div className="bonus-leading-report">
                <span>Leading bonus</span>
                {leadingReport ? (
                  <strong className={getBonusToneClass(leadingReport.bonus) ?? undefined}>
                    <span className="bonus-label-text">{formatBonusLabel(leadingReport.bonus)}</span>
                  </strong>
                ) : null}
                <em>{leadingReport?.count ?? 0} {(leadingReport?.count ?? 0) === 1 ? "report" : "reports"}</em>
              </div>
            ) : (
              <p className="bonus-no-reports">No reports yet</p>
            )}
          </div>
          {isReported && leadingReport ? <LargeBonusIcon bonus={leadingReport.bonus} /> : null}
        </div>

        {isReported ? (
          <div className="bonus-report-list" aria-label={`${zone.zoneName} reported bonuses`}>
            {zone.reports.map((report) => (
              <span
                className={["bonus-report-pill", getBonusToneClass(report.bonus)].filter(Boolean).join(" ")}
                key={report.bonus}
              >
                <strong>{formatBonusLabel(report.bonus)}</strong>
                <span>{report.count} {report.count === 1 ? "report" : "reports"}</span>
                <BonusIcon bonus={report.bonus} />
              </span>
            ))}
          </div>
        ) : null}

        {isReported ? (
          <div className="bonus-report-ownership-summary">
            {isAdmin ? (
              <button
                aria-expanded={isDetailsOpen}
                onClick={() => setOpenReportDetailsZone((currentZone) => (
                  currentZone === zone.zoneName ? null : zone.zoneName
                ))}
                type="button"
              >
                {isDetailsOpen ? "Hide report details" : "View report details"}
              </button>
            ) : null}
          </div>
        ) : null}

        {isAdmin && isReported && isDetailsOpen ? (
          <div className="bonus-admin-details">
            {reportSubmissions.map((submission) => {
              const createdAt = formatReportTimestamp(submission.createdAt);
              const updatedAt = formatReportTimestamp(submission.updatedAt);
              return (
                <div className="bonus-admin-detail-row" key={submission.id}>
                  <div>
                    <strong>{formatReporterName(submission)}</strong>
                    <span className={getBonusToneClass(submission.bonus) ?? undefined}>
                      {formatBonusLabel(submission.bonus)}
                    </span>
                    {createdAt ? <small>Created: {createdAt}</small> : null}
                    {updatedAt ? <small>Updated: {updatedAt}</small> : null}
                  </div>
                  <div>
                    <button
                      disabled={isModeratingReport}
                      onClick={() => deleteReport(submission.id)}
                      type="button"
                    >
                      Delete Report
                    </button>
                    <button
                      disabled={isModeratingReport}
                      onClick={() => banUser(submission.discordUserId)}
                      type="button"
                    >
                      Ban User
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {userReport ? (
          <div className="bonus-zone-actions">
            <span className="bonus-your-report">Your report: {formatBonusLabel(userReport)}</span>
          </div>
        ) : null}
      </article>
    );
  }

  function renderZoneGroups(groups: ZoneGroup[], mode: "reported" | "unreported") {
    return (
      <div className="bonus-zone-group-stack">
        {groups.map((group) => (
          <section className="bonus-zone-group" key={`${mode}-${group.key}`} aria-label={`${group.label} zones`}>
            <div className="bonus-zone-group-heading">
              <h3>{group.label} <span>({group.zones.length})</span></h3>
            </div>
            <div className={mode === "reported" ? "bonus-zone-grid is-reported" : "bonus-zone-grid is-unreported"}>
              {group.zones.map((zone) => renderZoneCard(zone, mode))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  function renderActiveReports() {
    if (!isLoggedIn || activeUserReports.length === 0) return null;

    return (
      <section className="bonus-active-reports" aria-label="Your active bonus reports">
        <div className="bonus-active-reports-heading">
          <h2>Your Active Reports <span>({activeUserReports.length})</span></h2>
        </div>
        <div className="bonus-active-report-list">
          <div className="bonus-active-report-row is-header" aria-hidden="true">
            <span>Zone</span>
            <span>Current Bonus</span>
            <span>Actions</span>
          </div>
          {activeUserReports.map((report) => (
            <div className="bonus-active-report-row" key={report.zoneName}>
              <div className="bonus-active-report-zone">
                <strong>{report.zoneName}</strong>
                <span className={`bonus-expansion-label ${getExpansionToneClass(report.expansion)}`}>
                  {report.expansion}
                </span>
              </div>
              <label className="bonus-active-report-select">
                <span>Current Bonus</span>
                <select
                  onChange={(event) => setActiveReportDrafts((currentDrafts) => ({
                    ...currentDrafts,
                    [report.zoneName]: event.target.value as BonusType,
                  }))}
                  value={activeReportDrafts[report.zoneName] ?? report.bonus}
                >
                  {managementBonusTypes.map((bonus) => (
                    <option key={bonus} value={bonus}>
                      {formatBonusLabel(bonus)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="bonus-active-report-actions">
                <button
                  className="bonus-active-report-change"
                  disabled={isSubmittingReport}
                  onClick={() => changeUserReport(report.zoneName)}
                  type="button"
                >
                  Change
                </button>
                <button
                  className="bonus-active-report-remove"
                  disabled={isSubmittingReport}
                  onClick={() => removeUserReport(report.zoneName)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="bonus-tracker" aria-label="Daily bonus tracker">
      <div className="bonus-toolbar">
        <label className="bonus-search">
          <span>Search zones</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by zone name"
            type="search"
            value={query}
          />
        </label>

        <div className="bonus-filter-group" aria-label="Expansion filters">
          <span className="bonus-filter-label">Expansion</span>
          <button
            aria-pressed={allExpansionsSelected}
            className={allExpansionsSelected ? "filter-button is-active" : "filter-button"}
            onClick={selectAllExpansions}
            type="button"
          >
            All
          </button>
          {expansionOptions.map((expansion) => {
            const isActive = selectedExpansionSet.has(expansion);
            return (
              <button
                aria-pressed={isActive}
                className={[
                  "filter-button",
                  "expansion-filter-button",
                  getExpansionToneClass(expansion),
                  isActive ? "is-active" : null,
                ].filter(Boolean).join(" ")}
                key={expansion}
                onClick={() => toggleExpansion(expansion)}
                type="button"
              >
                {expansion}
              </button>
            );
          })}
        </div>

        <div className="bonus-filter-group" aria-label="Bonus filters">
          <span className="bonus-filter-label">Bonus</span>
          {(["All", ...filterBonusTypes] as BonusFilter[]).map((bonus) => {
            const isActive = selectedBonus === bonus;
            return (
              <button
                aria-pressed={isActive}
                className={isActive ? "filter-button bonus-type-button is-active" : "filter-button bonus-type-button"}
                key={bonus}
                onClick={() => setSelectedBonus(bonus)}
                type="button"
              >
                {formatBonusLabel(bonus)}
              </button>
            );
          })}
        </div>

        <div className="bonus-status-submit-row">
          <div className="bonus-filter-group bonus-status-filter-group" aria-label="Status filters">
            <span className="bonus-filter-label">Status</span>
            {statusFilters.map((status) => {
              const isActive = selectedStatus === status;
              return (
                <button
                  aria-pressed={isActive}
                  className={isActive ? "filter-button is-active" : "filter-button"}
                  key={status}
                  onClick={() => selectStatusFilter(status)}
                  type="button"
                >
                  {status}
                </button>
              );
            })}
          </div>

          <div className="bonus-submit-panel" aria-label="Submit a daily bonus report">
            <label>
              <span>Zone</span>
              <select
                onChange={(event) => setSubmitZoneName(event.target.value)}
                value={submitZoneName}
              >
                {submissionZoneGroups.map((group) => (
                  <optgroup key={group.expansion} label={group.expansion}>
                    {group.zones.map((zone) => (
                      <option key={zone.zoneName} value={zone.zoneName}>
                        {zone.zoneName}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label>
              <span>Bonus</span>
              <select
                onChange={(event) => setSubmitBonus(event.target.value as FilterBonusType)}
                value={submitBonus}
              >
                {submissionBonusTypes.map((bonus) => (
                  <option key={bonus} value={bonus}>
                    {formatBonusLabel(bonus)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="bonus-submit-primary"
              disabled={isSubmittingReport || !isLoggedIn}
              onClick={submitReport}
              type="button"
            >
              {isSubmittingReport ? "Submitting..." : "Submit Bonus"}
            </button>
          </div>
        </div>
      </div>

      <div className="bonus-results-heading">
        <span>{visibleZones.length} zones</span>
        {activeFilters.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              selectAllExpansions();
              setSelectedBonus("All");
              setSelectedStatus("All");
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="bonus-auth-panel">
        {isLoggedIn ? (
          <>
            <span>Signed in as {session?.user?.discordUsername ?? session?.user?.name ?? "Discord user"}</span>
            <button onClick={() => signOut()} type="button">Sign out</button>
          </>
        ) : (
          <>
            <span>Sign in with Discord to submit reports.</span>
            <button onClick={() => signIn("discord")} type="button">Sign in with Discord</button>
          </>
        )}
      </div>

      {renderActiveReports()}

      {reportMessage ? <p className="bonus-report-message">{reportMessage}</p> : null}

      {visibleZones.length > 0 && selectedStatus === "Reported" ? (
        <section className="bonus-zone-section is-reported" aria-label="Reported bonuses">
          <div className="bonus-section-heading">
            <h2>Reported Bonuses ({visibleReportedZones.length})</h2>
          </div>
          {reportedZoneGroups.length > 0 ? (
            renderZoneGroups(reportedZoneGroups, "reported")
          ) : (
            <p className="empty bonus-empty">No reported zones match the active filters.</p>
          )}
        </section>
      ) : visibleZones.length > 0 && selectedStatus === "Unreported" ? (
        <section className="bonus-zone-section is-unreported" aria-label="Unreported zones">
          <div className="bonus-section-heading">
            <h2>Unreported Zones ({visibleUnreportedZones.length})</h2>
          </div>
          {unreportedZoneGroups.length > 0 ? (
            renderZoneGroups(unreportedZoneGroups, "unreported")
          ) : (
            <p className="empty bonus-empty">No unreported zones match the active filters.</p>
          )}
        </section>
      ) : visibleZones.length > 0 ? (
        <div className="bonus-section-stack">
          <section className="bonus-zone-section is-reported" aria-label="Reported bonuses">
            <div className="bonus-section-heading">
              <h2>Reported Bonuses ({visibleReportedZones.length})</h2>
            </div>
            {reportedZoneGroups.length > 0 ? (
              renderZoneGroups(reportedZoneGroups, "reported")
            ) : (
              <p className="empty bonus-empty">No reported zones match the active filters.</p>
            )}
          </section>

          {visibleUnreportedZones.length > 0 ? (
            <section className="bonus-zone-section is-unreported" aria-label="Unreported zones">
              <div className="bonus-section-heading">
                <h2>Unreported Zones ({visibleUnreportedZones.length})</h2>
                <button
                  aria-expanded={showUnreportedZones}
                  onClick={() => setShowUnreportedZones((isVisible) => !isVisible)}
                  type="button"
                >
                  {showUnreportedZones ? "Hide Unreported Zones" : "Show Unreported Zones"}
                </button>
              </div>
              {showUnreportedZones ? (
                renderZoneGroups(unreportedZoneGroups, "unreported")
              ) : (
                <p className="bonus-unreported-summary">
                  {visibleUnreportedZones.length} quiet zones are hidden so reported bonuses stay easy to scan.
                </p>
              )}
            </section>
          ) : null}
        </div>
      ) : (
        <p className="empty bonus-empty">{emptyMessage}</p>
      )}
    </section>
  );
}
