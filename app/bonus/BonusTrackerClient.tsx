"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

type BonusType =
  | "Experience"
  | "Coin"
  | "Loot"
  | "Rare"
  | "Skill"
  | "Respawn"
  | "Faction";

type Zone = {
  zoneName: string;
  expansion: string;
  reports: {
    bonus: BonusType;
    count: number;
  }[];
};

type BonusStatus = "Unreported" | "Single Report" | "Likely" | "Confirmed" | "Disputed";
type BonusFilter = "All" | BonusType;
type StatusFilter = "All" | BonusStatus;

type ServerBonusReport = {
  id: string;
  zoneName: string;
  bonus: BonusType;
  discordUserId: string;
  createdAt: string;
  updatedAt: string;
};

const bonusTypes: BonusType[] = [
  "Experience",
  "Coin",
  "Loot",
  "Rare",
  "Skill",
  "Respawn",
  "Faction",
];

const statusFilters: StatusFilter[] = [
  "All",
  "Unreported",
  "Single Report",
  "Likely",
  "Confirmed",
  "Disputed",
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

function getStatusClass(status: BonusStatus) {
  return `bonus-status-${status.toLowerCase().replace(/\s+/g, "-")}`;
}

function reportMatchesFilter(zone: Zone, selectedBonus: BonusFilter) {
  if (selectedBonus === "All") return true;
  return zone.reports.some((report) => report.bonus === selectedBonus && report.count > 0);
}

function applyServerReports(zone: Zone, reports: ServerBonusReport[]): Zone {
  const reportsByBonus = new Map<BonusType, Zone["reports"][number]>();

  for (const report of reports) {
    if (report.zoneName !== zone.zoneName) continue;

    const currentReport = reportsByBonus.get(report.bonus);
    reportsByBonus.set(report.bonus, {
      bonus: report.bonus,
      count: (currentReport?.count ?? 0) + 1,
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
  const [selectedExpansion, setSelectedExpansion] = useState("All");
  const [selectedBonus, setSelectedBonus] = useState<BonusFilter>("All");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("All");
  const [openReportZone, setOpenReportZone] = useState<string | null>(null);
  const [draftReports, setDraftReports] = useState<Record<string, BonusType | undefined>>({});
  const [serverReports, setServerReports] = useState<ServerBonusReport[]>([]);
  const [userReports, setUserReports] = useState<Record<string, BonusType | undefined>>({});
  const [reportMessage, setReportMessage] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const isLoggedIn = authStatus === "authenticated" && Boolean(session?.user?.discordUserId);

  const expansionOptions = useMemo(() => {
    return ["All", ...Array.from(new Set(zones.map((zone) => zone.expansion))).sort((a, b) => {
      return getExpansionSortValue(a) - getExpansionSortValue(b) || a.localeCompare(b);
    })];
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const reportedZones = useMemo(() => {
    return zones.map((zone) => applyServerReports(zone, serverReports));
  }, [serverReports]);

  useEffect(() => {
    let isCancelled = false;

    async function loadReports() {
      const response = await fetch("/api/bonus/reports", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as {
        reports?: ServerBonusReport[];
        currentUserReports?: Record<string, BonusType | undefined>;
      };
      if (isCancelled) return;
      setServerReports(Array.isArray(payload.reports) ? payload.reports : []);
      setUserReports(payload.currentUserReports ?? {});
    }

    loadReports();
    return () => {
      isCancelled = true;
    };
  }, [authStatus]);

  const visibleZones = useMemo(() => {
    return reportedZones.filter((zone) => {
      const searchMatches = zone.zoneName.toLowerCase().includes(normalizedQuery);
      const expansionMatches = selectedExpansion === "All" || zone.expansion === selectedExpansion;
      const statusMatches = selectedStatus === "All" || getZoneStatus(zone) === selectedStatus;
      return searchMatches && expansionMatches && statusMatches && reportMatchesFilter(zone, selectedBonus);
    });
  }, [normalizedQuery, reportedZones, selectedBonus, selectedExpansion, selectedStatus]);

  const activeFilters = [
    normalizedQuery ? `search ${query.trim()}` : null,
    selectedExpansion !== "All" ? `expansion ${selectedExpansion}` : null,
    selectedBonus !== "All" ? `bonus ${selectedBonus}` : null,
    selectedStatus !== "All" ? `status ${selectedStatus}` : null,
  ].filter(Boolean);
  const emptyMessage = activeFilters.length > 0
    ? `No zones match the active filters: ${activeFilters.join(", ")}.`
    : "No zones are available yet.";

  function openReportPanel(zoneName: string) {
    setReportMessage("");
    setOpenReportZone((currentZone) => currentZone === zoneName ? null : zoneName);
    setDraftReports((currentReports) => ({
      ...currentReports,
      [zoneName]: currentReports[zoneName] ?? userReports[zoneName] ?? "Experience",
    }));
  }

  async function submitReport(zoneName: string) {
    const draftReport = draftReports[zoneName];
    if (!draftReport) return;

    setIsSubmittingReport(true);
    setReportMessage("");

    try {
      const response = await fetch("/api/bonus/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneName, bonus: draftReport }),
      });
      const payload = await response.json().catch(() => ({})) as {
        reports?: ServerBonusReport[];
        currentUserReports?: Record<string, BonusType | undefined>;
        error?: string;
        remainingSeconds?: number;
      };

      if (response.ok) {
        setServerReports(Array.isArray(payload.reports) ? payload.reports : []);
        setUserReports(payload.currentUserReports ?? {});
        setOpenReportZone(null);
        setReportMessage("Report saved.");
        return;
      }

      if (response.status === 429 && typeof payload.remainingSeconds === "number") {
        setReportMessage(`You can submit another zone report in ${payload.remainingSeconds} seconds.`);
      } else if (response.status === 401) {
        setReportMessage("Sign in with Discord to submit reports.");
      } else {
        setReportMessage("Could not save that report. Please try again.");
      }
    } finally {
      setIsSubmittingReport(false);
    }
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
          {expansionOptions.map((expansion) => {
            const isActive = selectedExpansion === expansion;
            return (
              <button
                aria-pressed={isActive}
                className={isActive ? "filter-button is-active" : "filter-button"}
                key={expansion}
                onClick={() => setSelectedExpansion(expansion)}
                type="button"
              >
                {expansion}
              </button>
            );
          })}
        </div>

        <div className="bonus-filter-group" aria-label="Bonus filters">
          <span className="bonus-filter-label">Bonus</span>
          {(["All", ...bonusTypes] as BonusFilter[]).map((bonus) => {
            const isActive = selectedBonus === bonus;
            return (
              <button
                aria-pressed={isActive}
                className={isActive ? "filter-button is-active" : "filter-button"}
                key={bonus}
                onClick={() => setSelectedBonus(bonus)}
                type="button"
              >
                {bonus}
              </button>
            );
          })}
        </div>

        <div className="bonus-filter-group" aria-label="Status filters">
          <span className="bonus-filter-label">Status</span>
          {statusFilters.map((status) => {
            const isActive = selectedStatus === status;
            return (
              <button
                aria-pressed={isActive}
                className={isActive ? "filter-button is-active" : "filter-button"}
                key={status}
                onClick={() => setSelectedStatus(status)}
                type="button"
              >
                {status}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bonus-results-heading">
        <span>{visibleZones.length} zones</span>
        {activeFilters.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedExpansion("All");
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

      {reportMessage ? <p className="bonus-report-message">{reportMessage}</p> : null}

      {visibleZones.length > 0 ? (
        <div className="bonus-zone-grid">
          {visibleZones.map((zone) => {
            const leadingReport = getLeadingReport(zone);
            const status = getZoneStatus(zone);

            return (
              <article className="bonus-zone-card" key={zone.zoneName}>
                <div className="bonus-zone-card-main">
                  <div>
                    <div className="bonus-zone-title-row">
                      <h2>{zone.zoneName}</h2>
                      <span className="bonus-expansion-label">{zone.expansion}</span>
                    </div>
                    <p>
                      Leading bonus: <strong>{leadingReport?.bonus ?? "Unreported"}</strong>
                    </p>
                  </div>
                  <span className={`bonus-status ${getStatusClass(status)}`}>{status}</span>
                </div>

                <div className="bonus-report-list" aria-label={`${zone.zoneName} reported bonuses`}>
                  {zone.reports.length > 0 ? (
                    zone.reports.map((report) => (
                      <span className="bonus-report-pill" key={report.bonus}>
                        <strong>{report.bonus}</strong>
                        <span>{report.count} {report.count === 1 ? "report" : "reports"}</span>
                      </span>
                    ))
                  ) : (
                    <span className="bonus-report-pill">
                      <strong>Unreported</strong>
                      <span>0 reports</span>
                    </span>
                  )}
                </div>

                <div className="bonus-zone-actions">
                  {userReports[zone.zoneName] ? <span>Your report: {userReports[zone.zoneName]}</span> : null}
                  {isLoggedIn ? (
                    <button
                      className="bonus-report-action"
                      onClick={() => openReportPanel(zone.zoneName)}
                      type="button"
                    >
                      {userReports[zone.zoneName] ? "Change Report" : "Submit Report"}
                    </button>
                  ) : (
                    <button
                      className="bonus-report-action"
                      onClick={() => signIn("discord")}
                      type="button"
                    >
                      Sign in with Discord to submit reports
                    </button>
                  )}
                </div>

                {isLoggedIn && openReportZone === zone.zoneName ? (
                  <div className="bonus-report-panel">
                    <div className="bonus-report-panel-heading">
                      <h3>{userReports[zone.zoneName] ? "Change your report" : "Submit your report"}</h3>
                      <button onClick={() => setOpenReportZone(null)} type="button">Cancel</button>
                    </div>
                    <div className="bonus-report-options" aria-label={`Select bonus for ${zone.zoneName}`}>
                      {bonusTypes.map((bonus) => {
                        const isSelected = draftReports[zone.zoneName] === bonus;
                        return (
                          <button
                            aria-pressed={isSelected}
                            className={isSelected ? "filter-button is-active" : "filter-button"}
                            key={bonus}
                            onClick={() => setDraftReports((currentReports) => ({
                              ...currentReports,
                              [zone.zoneName]: bonus,
                            }))}
                            type="button"
                          >
                            {bonus}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      className="bonus-report-submit"
                      disabled={isSubmittingReport}
                      onClick={() => submitReport(zone.zoneName)}
                      type="button"
                    >
                      {isSubmittingReport ? "Saving..." : "Save Report"}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty bonus-empty">{emptyMessage}</p>
      )}
    </section>
  );
}
