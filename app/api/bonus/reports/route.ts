import { Pool, type PoolClient } from "pg";
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
  discordUsername: string | null;
  createdAt: string;
  updatedAt: string;
};

type BonusReportRow = {
  id: string;
  zonename: string;
  bonus: BonusType;
  discorduserid: string;
  discordusername: string | null;
  createdat: Date;
  updatedat: Date;
};

let pool: Pool | undefined;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for bonus report storage.");
  }

  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

function isBonusType(value: unknown): value is BonusType {
  return typeof value === "string" && bonusTypes.includes(value as BonusType);
}

function mapReport(row: BonusReportRow): BonusReportRecord {
  return {
    id: row.id,
    zoneName: row.zonename,
    bonus: row.bonus,
    discordUserId: row.discorduserid,
    discordUsername: row.discordusername,
    createdAt: row.createdat.toISOString(),
    updatedAt: row.updatedat.toISOString(),
  };
}

async function getAllReports() {
  const result = await getPool().query<BonusReportRow>(
    `select
       id,
       "zoneName" as zonename,
       bonus,
       "discordUserId" as discorduserid,
       "discordUsername" as discordusername,
       "createdAt" as createdat,
       "updatedAt" as updatedat
     from bonus_reports
     order by "zoneName" asc, "updatedAt" desc`,
  );
  return result.rows.map(mapReport);
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
  };
}

function databaseErrorResponse(error: unknown, context: Record<string, unknown>) {
  console.error("[bonus-reports] Database operation failed", {
    ...context,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    error,
  });

  return Response.json(
    {
      error: "DATABASE_ERROR",
      message: "Report storage is temporarily unavailable.",
    },
    { status: 500 },
  );
}

export async function GET() {
  const currentUser = await getDiscordSessionUser();

  try {
    const reports = await getAllReports();
    return Response.json({
      reports,
      currentUserReports: getCurrentUserReports(reports, currentUser?.discordUserId),
    });
  } catch (error) {
    return databaseErrorResponse(error, { action: "list-reports" });
  }
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

  let client: PoolClient | undefined;

  try {
    client = await getPool().connect();
    await client.query("begin");

    const existingReport = await client.query<{ id: string }>(
      `select id
       from bonus_reports
       where "discordUserId" = $1 and "zoneName" = $2
       for update`,
      [currentUser.discordUserId, zoneName],
    );

    if (existingReport.rowCount === 0) {
      const latestReport = await client.query<{ createdat: Date }>(
        `select "createdAt" as createdat
         from bonus_reports
         where "discordUserId" = $1
         order by "createdAt" desc
         limit 1`,
        [currentUser.discordUserId],
      );

      const latestCreatedAt = latestReport.rows[0]?.createdat;
      if (latestCreatedAt) {
        const elapsedSeconds = Math.floor((Date.now() - latestCreatedAt.getTime()) / 1000);
        if (elapsedSeconds < REPORT_COOLDOWN_SECONDS) {
          await client.query("rollback");
          return Response.json(
            {
              error: "RATE_LIMITED",
              remainingSeconds: REPORT_COOLDOWN_SECONDS - elapsedSeconds,
            },
            { status: 429 },
          );
        }
      }
    }

    // TODO: Add admin banning controls and an audit trail for moderator actions.
    // TODO: Add screenshot proof metadata when report verification is introduced.
    // TODO: Add max zones per 10 minutes once report volume is high enough to tune it.
    // TODO: Add trust weighting when the confidence system starts using reporter reputation.
    await client.query(
      `insert into bonus_reports ("zoneName", bonus, "discordUserId", "discordUsername")
       values ($1, $2, $3, $4)
       on conflict ("discordUserId", "zoneName")
       do update set
         bonus = excluded.bonus,
         "discordUsername" = excluded."discordUsername",
         "updatedAt" = now()`,
      [zoneName, bonus, currentUser.discordUserId, currentUser.username],
    );

    const reportsResult = await client.query<BonusReportRow>(
      `select
         id,
         "zoneName" as zonename,
         bonus,
         "discordUserId" as discorduserid,
         "discordUsername" as discordusername,
         "createdAt" as createdat,
         "updatedAt" as updatedat
       from bonus_reports
       order by "zoneName" asc, "updatedAt" desc`,
    );

    await client.query("commit");

    const reports = reportsResult.rows.map(mapReport);
    return Response.json({
      success: true,
      reports,
      currentUserReports: getCurrentUserReports(reports, currentUser.discordUserId),
    });
  } catch (error) {
    await client?.query("rollback").catch(() => {});
    return databaseErrorResponse(error, {
      action: "submit-report",
      zoneName,
      discordUserId: currentUser.discordUserId,
    });
  } finally {
    client?.release();
  }
}
