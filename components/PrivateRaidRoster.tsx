"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";

type Toon = {
  id: string;
  name: string;
  className: string;
  level: string;
  raidTag: string;
  notes: string;
};

type Account = {
  id: string;
  accountId: string;
  login: string;
  status: "Active" | "Deactive" | "Suspended";
  lastChecked: string;
  notes: string;
  characters: Toon[];
};

type Roster = {
  accounts: Account[];
  raidNotes: Record<string, string>;
};

const classOptions = ["Bard", "Cleric", "Druid", "Enchanter", "Magician", "Monk", "Necromancer", "Paladin", "Ranger", "Shaman", "Trader", "Warrior", "Unknown"];
const raidOptions = ["", "Raid 1", "Raid 2", "Raid 3", "Bench"];
const statusOptions = ["Active", "Deactive", "Suspended"] as const;

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyToon(): Toon {
  return { id: makeId("toon"), name: "", className: "Unknown", level: "", raidTag: "", notes: "" };
}

function emptyAccount(): Account {
  return {
    id: makeId("acct"),
    accountId: "NEW",
    login: "",
    status: "Active",
    lastChecked: "",
    notes: "",
    characters: [emptyToon()],
  };
}

function normalizeRoster(raw: unknown): Roster {
  const source = raw as { accounts?: unknown; raidNotes?: unknown } | null;
  const sourceAccounts = Array.isArray((raw as { accounts?: unknown })?.accounts)
    ? (raw as { accounts: Array<Partial<Account> & { password?: unknown }> }).accounts
    : Array.isArray(raw)
      ? raw as Array<Partial<Account> & { password?: unknown }>
      : [];

  return {
    raidNotes: source?.raidNotes && typeof source.raidNotes === "object" && !Array.isArray(source.raidNotes)
      ? source.raidNotes as Record<string, string>
      : {},
    accounts: sourceAccounts.map((account) => ({
      ...emptyAccount(),
      ...account,
      password: undefined,
      status: statusOptions.includes(account.status as Account["status"]) ? account.status as Account["status"] : "Active",
      characters: Array.isArray(account.characters)
        ? account.characters.map((toon) => ({
            ...emptyToon(),
            ...toon,
            raidTag: raidOptions.includes(String(toon.raidTag ?? "")) ? String(toon.raidTag ?? "") : "",
          }))
        : [],
    })).map(({ password: _password, ...account }) => account),
  };
}

function highestLevel(account: Account) {
  return Math.max(0, ...account.characters.map((toon) => Number.parseInt(toon.level, 10) || 0));
}

function classSummary(account: Account) {
  const counts = new Map<string, number>();
  for (const toon of account.characters) {
    const key = toon.className || "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([className, count]) => `${count} ${className}`)
    .join(", ");
}

function formatSavedAt(value: string | null) {
  if (!value) return "Not saved yet";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function PrivateRaidRoster() {
  const { data: session, status } = useSession();
  const [roster, setRoster] = useState<Roster>({ accounts: [], raidNotes: {} });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [raidView, setRaidView] = useState("Raid 1");
  const [minLevel, setMinLevel] = useState("1");
  const [activeOnly, setActiveOnly] = useState(true);
  const [pasteText, setPasteText] = useState("");
  const [message, setMessage] = useState("Log in with Discord to load the shared roster.");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);

  const isSignedIn = status === "authenticated" && Boolean(session?.user?.discordUserId);

  useEffect(() => {
    if (!isSignedIn) return;
    void loadRoster();
  }, [isSignedIn]);

  useEffect(() => {
    if (!isDirty || !hasLoadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveRoster();
    }, 900);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [roster, isDirty]);

  async function loadRoster() {
    setIsLoading(true);
    setMessage("Loading shared roster...");
    try {
      const response = await fetch("/api/private/raid-roster", { cache: "no-store" });
      if (response.status === 403) {
        setMessage("This Discord account is not allowed to view the roster.");
        return;
      }
      if (!response.ok) {
        setMessage("Shared roster could not be loaded.");
        return;
      }
      const payload = await response.json() as {
        roster?: unknown;
        updatedAt?: string | null;
        updatedByDiscordUsername?: string | null;
      };
      const nextRoster = normalizeRoster(payload.roster ?? { accounts: [] });
      setRoster(nextRoster);
      setExpanded(new Set(nextRoster.accounts.slice(0, 3).map((account) => account.id)));
      setUpdatedAt(payload.updatedAt ?? null);
      setUpdatedBy(payload.updatedByDiscordUsername ?? null);
      hasLoadedRef.current = true;
      setIsDirty(false);
      setMessage("Shared roster loaded.");
    } catch {
      setMessage("Shared roster could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveRoster() {
    if (!isSignedIn) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/private/raid-roster", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roster }),
      });
      if (!response.ok) {
        setMessage(response.status === 403 ? "This Discord account cannot save the roster." : "Shared roster could not be saved.");
        return;
      }
      const payload = await response.json() as { updatedAt?: string | null; updatedByDiscordUsername?: string | null };
      setUpdatedAt(payload.updatedAt ?? new Date().toISOString());
      setUpdatedBy(payload.updatedByDiscordUsername ?? session?.user?.discordUsername ?? session?.user?.name ?? null);
      setIsDirty(false);
      setMessage("Autosaved.");
    } catch {
      setMessage("Shared roster could not be saved.");
    } finally {
      setIsLoading(false);
    }
  }

  function updateRoster(updater: (current: Roster) => Roster) {
    setRoster((current) => normalizeRoster(updater(current)));
    setIsDirty(true);
  }

  function updateAccount(accountId: string, patch: Partial<Account>) {
    updateRoster((current) => ({
      ...current,
      accounts: current.accounts.map((account) => account.id === accountId ? { ...account, ...patch } : account),
    }));
  }

  function updateToon(accountId: string, toonId: string, patch: Partial<Toon>) {
    updateRoster((current) => ({
      ...current,
      accounts: current.accounts.map((account) => account.id === accountId
        ? { ...account, characters: account.characters.map((toon) => toon.id === toonId ? { ...toon, ...patch } : toon) }
        : account),
    }));
  }

  function addAccount() {
    const account = emptyAccount();
    updateRoster((current) => ({ ...current, accounts: [account, ...current.accounts] }));
    setExpanded((current) => new Set(current).add(account.id));
  }

  function addToon(accountId: string) {
    updateRoster((current) => ({
      ...current,
      accounts: current.accounts.map((account) => account.id === accountId
        ? { ...account, characters: [...account.characters, emptyToon()] }
        : account),
    }));
  }

  function removeAccount(accountId: string) {
    updateRoster((current) => ({ ...current, accounts: current.accounts.filter((account) => account.id !== accountId) }));
    setExpanded((current) => {
      const next = new Set(current);
      next.delete(accountId);
      return next;
    });
  }

  function removeToon(accountId: string, toonId: string) {
    updateRoster((current) => ({
      ...current,
      accounts: current.accounts.map((account) => account.id === accountId
        ? { ...account, characters: account.characters.filter((toon) => toon.id !== toonId) }
        : account),
    }));
  }

  function importBackup() {
    try {
      const parsed = JSON.parse(pasteText);
      const nextRoster = normalizeRoster(parsed);
      setRoster(nextRoster);
      setExpanded(new Set(nextRoster.accounts.slice(0, 3).map((account) => account.id)));
      setPasteText("");
      setIsDirty(true);
      setMessage("Imported backup. Password fields were discarded. Autosaving...");
    } catch {
      setMessage("That does not look like a valid JSON backup.");
    }
  }

  async function copyBackup() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(roster.accounts, null, 2));
      setMessage("Backup copied.");
    } catch {
      setPasteText(JSON.stringify(roster.accounts, null, 2));
      setMessage("Clipboard was blocked, so the backup is in the paste box.");
    }
  }

  function clearRaid() {
    updateRoster((current) => ({
      ...current,
      accounts: current.accounts.map((account) => ({
        ...account,
        characters: account.characters.map((toon) => toon.raidTag === raidView ? { ...toon, raidTag: "" } : toon),
      })),
    }));
  }

  function updateRaidNote(raidTag: string, note: string) {
    updateRoster((current) => ({
      ...current,
      raidNotes: {
        ...current.raidNotes,
        [raidTag]: note,
      },
    }));
  }

  const filteredAccounts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return roster.accounts
      .filter((account) => {
        if (statusFilter !== "all" && account.status !== statusFilter) return false;
        if (classFilter !== "all" && !account.characters.some((toon) => toon.className === classFilter)) return false;
        if (!needle) return true;
        return [
          account.accountId,
          account.login,
          account.status,
          account.notes,
          ...account.characters.flatMap((toon) => [toon.name, toon.className, toon.level, toon.raidTag, toon.notes]),
        ].join(" ").toLocaleLowerCase().includes(needle);
      })
      .sort((left, right) => left.accountId.localeCompare(right.accountId));
  }, [classFilter, query, roster.accounts, statusFilter]);

  const raidPlan = useMemo(() => {
    const levelFloor = Number.parseInt(minLevel, 10) || 1;
    const picks = roster.accounts.flatMap((account) => {
      if (activeOnly && account.status !== "Active") return [];
      return account.characters
        .filter((toon) => toon.raidTag === raidView)
        .map((toon) => ({ account, toon, level: Number.parseInt(toon.level, 10) || 0 }))
        .filter((pick) => pick.level >= levelFloor);
    });

    const counts = new Map<string, number>();
    const byAccount = new Map<string, typeof picks>();
    for (const pick of picks) {
      counts.set(pick.toon.className || "Unknown", (counts.get(pick.toon.className || "Unknown") ?? 0) + 1);
      byAccount.set(pick.account.id, [...(byAccount.get(pick.account.id) ?? []), pick]);
    }

    return {
      picks: picks.sort((left, right) => left.toon.className.localeCompare(right.toon.className) || right.level - left.level),
      counts: Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
      conflicts: Array.from(byAccount.values()).filter((items) => items.length > 1),
      byClass: Array.from(counts.keys())
        .sort((left, right) => left.localeCompare(right))
        .map((className) => ({
          className,
          picks: picks
            .filter((pick) => (pick.toon.className || "Unknown") === className)
            .sort((left, right) => right.level - left.level || left.toon.name.localeCompare(right.toon.name)),
        })),
    };
  }, [activeOnly, minLevel, raidView, roster.accounts]);

  const stats = useMemo(() => {
    const toonCount = roster.accounts.reduce((sum, account) => sum + account.characters.length, 0);
    return {
      accounts: roster.accounts.length,
      toons: toonCount,
      active: roster.accounts.filter((account) => account.status === "Active").length,
      raid: raidPlan.picks.length,
    };
  }, [raidPlan.picks.length, roster.accounts]);

  if (status === "loading") {
    return <p className="private-raid-gate">Checking Discord login...</p>;
  }

  if (!isSignedIn) {
    return (
      <section className="private-raid-gate">
        <p className="eyebrow">Private Tool</p>
        <h1>Raid Roster</h1>
        <p>Log in with Discord to view the shared roster.</p>
        <button className="private-raid-button is-primary" onClick={() => signIn("discord")} type="button">Login with Discord</button>
      </section>
    );
  }

  return (
    <section className="private-raid-tool">
      <header className="private-raid-header">
        <div>
          <p className="eyebrow">Private Tool</p>
          <h1>Raid Roster</h1>
          <p>Shared roster for allowed Discord users only. Password fields are not stored here.</p>
        </div>
        <div className="private-raid-actions">
          <button className="private-raid-button is-primary" onClick={addAccount} type="button">Add Account</button>
          <button className="private-raid-button" disabled={isLoading} onClick={loadRoster} type="button">Refresh</button>
          <button className="private-raid-button is-save" disabled={isLoading || !isDirty} onClick={saveRoster} type="button">{isDirty ? "Save Now" : "Saved"}</button>
          <button className="private-raid-button" onClick={copyBackup} type="button">Copy Backup</button>
        </div>
      </header>

      <div className="private-raid-panel private-raid-status">
        <span>{message}</span>
        <span>Last save: {formatSavedAt(updatedAt)}{updatedBy ? ` by ${updatedBy}` : ""}</span>
      </div>

      <section className="private-raid-stats" aria-label="Roster summary">
        <div className="private-raid-stat"><span>Accounts</span><strong>{stats.accounts}</strong></div>
        <div className="private-raid-stat"><span>Toons</span><strong>{stats.toons}</strong></div>
        <div className="private-raid-stat"><span>Active</span><strong>{stats.active}</strong></div>
        <div className="private-raid-stat"><span>{raidView}</span><strong>{stats.raid}</strong></div>
      </section>

      <section className="private-raid-panel" aria-label="Raid planner">
        <div className="private-raid-toolbar">
          <label>View Raid
            <select value={raidView} onChange={(event) => setRaidView(event.target.value)}>
              {raidOptions.filter(Boolean).map((raid) => <option key={raid} value={raid}>{raid}</option>)}
            </select>
          </label>
          <label>Min Level <input value={minLevel} onChange={(event) => setMinLevel(event.target.value)} inputMode="numeric" /></label>
          <label>Active Only
            <select value={activeOnly ? "yes" : "no"} onChange={(event) => setActiveOnly(event.target.value === "yes")}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <button className="private-raid-button is-danger" onClick={clearRaid} type="button">Clear This Raid</button>
        </div>

        <label className="private-raid-note-field">
          Raid Notes
          <textarea
            value={roster.raidNotes[raidView] ?? ""}
            onChange={(event) => updateRaidNote(raidView, event.target.value)}
            placeholder={`Notes for ${raidView}: targets, missing buffs, who is boxing what...`}
          />
        </label>

        <div className="private-raid-grid">
          <div className="private-raid-composition">
            <h2>Composition</h2>
            <div className="private-raid-list">
              {raidPlan.counts.length ? raidPlan.counts.map(([className, count]) => (
                <div className="private-raid-row" key={className}>
                  <strong>{className}</strong><span>{count}</span>
                </div>
              )) : <p className="private-raid-muted">No characters tagged for this raid.</p>}
            </div>
          </div>
          <div>
            <h2>Raid Characters</h2>
            <div className="private-raid-class-groups">
              {raidPlan.byClass.length ? raidPlan.byClass.map((group) => (
                <section className="private-raid-class-group" key={group.className}>
                  <div className="private-raid-class-heading">
                    <strong>{group.className}</strong>
                    <span>{group.picks.length}</span>
                  </div>
                  <div className="private-raid-list">
                    {group.picks.map((pick) => (
                      <div className="private-raid-row" key={`${pick.account.id}-${pick.toon.id}`}>
                        <span>{pick.toon.name}</span>
                        <span>{pick.level || "-"}</span>
                        <span>{pick.account.accountId} / {pick.account.login}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )) : <p className="private-raid-muted">Assign characters using the Raid dropdown in account rows.</p>}
            </div>
          </div>
          <div>
            <h2>Conflicts</h2>
            <div className="private-raid-list">
              {raidPlan.conflicts.length ? raidPlan.conflicts.map((conflict) => (
                <div className="private-raid-row" key={conflict[0].account.id}>
                  <strong className="private-raid-short">{conflict[0].account.accountId}</strong>
                  <span>{conflict.map((pick) => `${pick.toon.name} (${pick.toon.className})`).join(", ")}</span>
                </div>
              )) : <p className="private-raid-good">No same-account conflicts.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="private-raid-panel private-raid-import" aria-label="Import backup">
        <textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="Paste JSON backup from the standalone app here" />
        <div className="private-raid-import-actions">
          <button className="private-raid-button is-primary" onClick={importBackup} type="button">Import Backup</button>
        </div>
      </section>

      <section className="private-raid-panel" aria-label="Roster filters">
        <div className="private-raid-toolbar">
          <label>Search <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Account, login, toon, class" /></label>
          <label>Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All</option>
              {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>Class
            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
              <option value="all">All</option>
              {classOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="private-raid-listing" aria-label="Accounts">
        {filteredAccounts.length ? filteredAccounts.map((account) => {
          const open = expanded.has(account.id);
          return (
            <article className="private-raid-card" key={account.id}>
              <button
                className="private-raid-card-summary"
                onClick={() => setExpanded((current) => {
                  const next = new Set(current);
                  next.has(account.id) ? next.delete(account.id) : next.add(account.id);
                  return next;
                })}
                type="button"
              >
                <span className="private-raid-expand">{open ? "-" : "+"}</span>
                <span><strong>{account.accountId}</strong><br /><small>{account.login || "No login"}</small></span>
                <span className={`private-raid-pill is-${account.status.toLowerCase()}`}>{account.status}</span>
                <span className="private-raid-pill">{account.characters.length} toons</span>
                <span>{classSummary(account) || "No classes"}</span>
              </button>

              {open ? (
                <div className="private-raid-details">
                  <div className="private-raid-account-fields">
                    <label>Account ID<input value={account.accountId} onChange={(event) => updateAccount(account.id, { accountId: event.target.value })} /></label>
                    <label>Login/User<input value={account.login} onChange={(event) => updateAccount(account.id, { login: event.target.value })} /></label>
                    <label>Status
                      <select value={account.status} onChange={(event) => updateAccount(account.id, { status: event.target.value as Account["status"] })}>
                        {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label>Last Checked<input type="date" value={account.lastChecked} onChange={(event) => updateAccount(account.id, { lastChecked: event.target.value })} /></label>
                    <label>Notes<input value={account.notes} onChange={(event) => updateAccount(account.id, { notes: event.target.value })} /></label>
                  </div>

                  <div className="private-raid-toon-table">
                    <div className="private-raid-toon-head"><span>Name</span><span>Class</span><span>Level</span><span>Raid</span><span>Notes</span><span></span></div>
                    {account.characters.map((toon) => (
                      <div className="private-raid-toon-row" key={toon.id}>
                        <input value={toon.name} onChange={(event) => updateToon(account.id, toon.id, { name: event.target.value })} aria-label="Toon name" />
                        <select value={toon.className} onChange={(event) => updateToon(account.id, toon.id, { className: event.target.value })} aria-label="Class">
                          {classOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <input value={toon.level} onChange={(event) => updateToon(account.id, toon.id, { level: event.target.value })} inputMode="numeric" aria-label="Level" />
                        <select value={toon.raidTag} onChange={(event) => updateToon(account.id, toon.id, { raidTag: event.target.value })} aria-label="Raid tag">
                          {raidOptions.map((option) => <option key={option || "none"} value={option}>{option || "None"}</option>)}
                        </select>
                        <input value={toon.notes} onChange={(event) => updateToon(account.id, toon.id, { notes: event.target.value })} aria-label="Notes" />
                        <button className="private-raid-icon-button" onClick={() => removeToon(account.id, toon.id)} type="button" aria-label="Remove toon">x</button>
                      </div>
                    ))}
                  </div>

                  <div className="private-raid-card-actions">
                    <button className="private-raid-button is-primary" onClick={() => addToon(account.id)} type="button">Add Toon</button>
                    <button className="private-raid-button" onClick={() => updateAccount(account.id, { lastChecked: new Date().toISOString().slice(0, 10) })} type="button">Mark Checked Today</button>
                    <button className="private-raid-button is-danger" onClick={() => removeAccount(account.id)} type="button">Delete Account</button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        }) : <p className="private-raid-panel private-raid-muted">No accounts match the active filters.</p>}
      </section>
    </section>
  );
}
