import { promises as fs } from "node:fs";
import path from "node:path";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const REPORT_COOLDOWN_SECONDS = 60;
const bonusTypes = ["Experience", "Coin", "Loot", "Rare", "Skill", "Respawn", "Faction"] as const;

type BonusType = (typeof bonusTypes)[number];

type BonusReportRecord = {
  id: string;
  zoneName: string;
  bonus: BonusType;
  discordUserId: string;
  createdAt: string;
  updatedAt: string;
};

type BonusUserRecord = {
  discordUserId: string;
  username?: string | null;
  avatarUrl?: string | null;
  banned?: boolean;
  trustScore?: number;
};

type BonusReportStore = {
  reports: BonusReportRecord[];
  users: BonusUserRecord[];
};

const storePath = path.join(process.cwd(), "data", "bonus-reports.json");

async function readStore(): Promise<BonusReportStore> {
  try {
    const contents = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(contents) as Partial<BonusReportStore>;
    return {
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
    };
  } catch {
    return { reports: [], users: [] };
  }
}

async function writeStore(store: BonusReportStore) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function isBonusType(value: unknown): value is BonusType {
  return typeof value === "string" && bonusTypes.includes(value as BonusType);
}

function getCurrentUserReports(reports: BonusReportRecord[], discordUserId: string | undefined) {
  if (!discordUserId) return {};

  return Object.fromEntries(
    reports
      .filter((report) => report.discordUserId === discordUserId)
      .map((report) => [report.zoneName, report.bonus]),
  );
}

async function getDiscordSessionUser() {
  const session = await getServerSession(authOptions);
  const discordUserId = session?.user?.discordUserId;
  if (!discordUserId) return null;

  return {
    discordUserId,
    username: session.user?.discordUsername ?? session.user?.name ?? null,
    avatarUrl: session.user?.image ?? null,
  };
}

export async function GET() {
  const store = await readStore();
  const currentUser = await getDiscordSessionUser();

  return Response.json({
    reports: store.reports,
    currentUserReports: getCurrentUserReports(store.reports, currentUser?.discordUserId),
  });
}

export async function POST(request: Request) {
  const currentUser = await getDiscordSessionUser();
  if (!currentUser) {
    return Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { zoneName?: unknown; bonus?: unknown } | null;
  const zoneName = typeof body?.zoneName === "string" ? body.zoneName.trim() : "";
  const bonus = body?.bonus;

  if (!zoneName || !isBonusType(bonus)) {
    return Response.json({ error: "INVALID_REPORT" }, { status: 400 });
  }

  const store = await readStore();
  const user = store.users.find((record) => record.discordUserId === currentUser.discordUserId);
  // TODO: Add admin banning controls and an audit trail for moderator actions.
  if (user?.banned) {
    return Response.json({ error: "USER_BANNED" }, { status: 403 });
  }

  if (user) {
    user.username = currentUser.username;
    user.avatarUrl = currentUser.avatarUrl;
  } else {
    store.users.push({
      discordUserId: currentUser.discordUserId,
      username: currentUser.username,
      avatarUrl: currentUser.avatarUrl,
      banned: false,
      trustScore: 0,
    });
  }

  const now = new Date();
  const existingReport = store.reports.find((report) =>
    report.discordUserId === currentUser.discordUserId && report.zoneName === zoneName
  );

  if (existingReport) {
    existingReport.bonus = bonus;
    existingReport.updatedAt = now.toISOString();
    await writeStore(store);

    return Response.json({
      success: true,
      reports: store.reports,
      currentUserReports: getCurrentUserReports(store.reports, currentUser.discordUserId),
    });
  }

  const latestNewZoneReport = store.reports
    .filter((report) => report.discordUserId === currentUser.discordUserId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

  if (latestNewZoneReport) {
    const elapsedSeconds = Math.floor((now.getTime() - Date.parse(latestNewZoneReport.createdAt)) / 1000);
    if (elapsedSeconds < REPORT_COOLDOWN_SECONDS) {
      return Response.json(
        {
          error: "RATE_LIMITED",
          remainingSeconds: REPORT_COOLDOWN_SECONDS - elapsedSeconds,
        },
        { status: 429 },
      );
    }
  }

  // TODO: Add screenshot proof metadata when report verification is introduced.
  // TODO: Add max zones per 10 minutes once report volume is high enough to tune it.
  // TODO: Add trust weighting when the confidence system starts using reporter reputation.
  store.reports.push({
    id: crypto.randomUUID(),
    zoneName,
    bonus,
    discordUserId: currentUser.discordUserId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  await writeStore(store);

  return Response.json({
    success: true,
    reports: store.reports,
    currentUserReports: getCurrentUserReports(store.reports, currentUser.discordUserId),
  });
}
