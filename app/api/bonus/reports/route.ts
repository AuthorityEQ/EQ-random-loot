import { Pool, type PoolClient } from "pg";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const REPORT_COOLDOWN_SECONDS = 60;
const bonusTypes = ["Experience", "AA", "Coin", "Loot", "Rare", "Skill", "Respawn", "Faction", "None"] as const;

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

type BannedUserRecord = {
  discordUserId: string;
  discordUsername: string | null;
  reason: string | null;
  bannedByDiscordUserId: string | null;
  bannedByDiscordUsername: string | null;
  createdAt: string;
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

type BannedUserRow = {
  discorduserid: string;
  discordusername: string | null;
  reason: string | null;
  bannedbydiscorduserid: string | null;
  bannedbydiscordusername: string | null;
  createdat: Date;
};

type BonusPostBody =
  | {
      action?: undefined;
      zoneName?: unknown;
      bonus?: unknown;
    }
  | {
      action: "banUser";
      discordUserId?: unknown;
    }
  | {
      action: "unbanUser";
      discordUserId?: unknown;
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

function isAdminSessionUserId(sessionUserId: string | undefined) {
  return Boolean(sessionUserId && process.env.ADMIN_DISCORD_ID && sessionUserId === process.env.ADMIN_DISCORD_ID);
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

function mapBannedUser(row: BannedUserRow): BannedUserRecord {
  return {
    discordUserId: row.discorduserid,
    discordUsername: row.discordusername,
    reason: row.reason,
    bannedByDiscordUserId: row.bannedbydiscorduserid,
    bannedByDiscordUsername: row.bannedbydiscordusername,
    createdAt: row.createdat.toISOString(),
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

async function getBannedUsers() {
  const result = await getPool().query<BannedUserRow>(
    `select
       banned_users."discordUserId" as discorduserid,
       coalesce(
         banned_users."discordUsername",
         latest_reports."discordUsername"
       ) as discordusername,
       banned_users.reason,
       banned_users."bannedByDiscordUserId" as bannedbydiscorduserid,
       banned_users."bannedByDiscordUsername" as bannedbydiscordusername,
       banned_users."createdAt" as createdat
     from banned_users
     left join lateral (
       select "discordUsername"
       from bonus_reports
       where bonus_reports."discordUserId" = banned_users."discordUserId"
       order by "updatedAt" desc
       limit 1
     ) latest_reports on true
     order by banned_users."createdAt" desc`,
  );
  return result.rows.map(mapBannedUser);
}

async function ensureModerationTables(client: Pool | PoolClient = getPool()) {
  await client.query(
    `create table if not exists banned_users (
       "discordUserId" text primary key,
       "createdAt" timestamptz not null default now()
     )`,
  );
  await client.query(`alter table banned_users add column if not exists "discordUsername" text`);
  await client.query(`alter table banned_users add column if not exists reason text`);
  await client.query(`alter table banned_users add column if not exists "bannedByDiscordUserId" text`);
  await client.query(`alter table banned_users add column if not exists "bannedByDiscordUsername" text`);
}

async function isBannedUser(client: Pool | PoolClient, discordUserId: string) {
  const result = await client.query<{ exists: boolean }>(
    `select exists(
       select 1
       from banned_users
       where "discordUserId" = $1
     )`,
    [discordUserId],
  );
  return Boolean(result.rows[0]?.exists);
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
  const sessionUserId = session?.user?.id;
  const discordUserId = session?.user?.discordUserId ?? sessionUserId;
  if (!discordUserId) return null;

  return {
    discordUserId,
    sessionUserId,
    username: session?.user?.discordUsername ?? session?.user?.name ?? null,
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
  const isAdmin = isAdminSessionUserId(currentUser?.sessionUserId);

  try {
    if (isAdmin) {
      await ensureModerationTables();
    }
    const reports = await getAllReports();
    return Response.json({
      reports,
      currentUserReports: getCurrentUserReports(reports, currentUser?.discordUserId),
      isAdmin,
      bannedUsers: isAdmin ? await getBannedUsers() : [],
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

  const body = await request.json().catch(() => null) as BonusPostBody | null;

  if (body?.action === "banUser") {
    if (!isAdminSessionUserId(currentUser.sessionUserId)) {
      return Response.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
    }

    const bannedDiscordUserId = typeof body.discordUserId === "string" ? body.discordUserId.trim() : "";
    if (!bannedDiscordUserId) {
      return Response.json({ error: "INVALID_BAN" }, { status: 400 });
    }
    if (bannedDiscordUserId === currentUser.discordUserId || bannedDiscordUserId === currentUser.sessionUserId) {
      return Response.json({ error: "CANNOT_BAN_SELF" }, { status: 400 });
    }

    try {
      const pool = getPool();
      await ensureModerationTables(pool);
      const latestUserReport = await pool.query<{ discordusername: string | null }>(
        `select "discordUsername" as discordusername
         from bonus_reports
         where "discordUserId" = $1
         order by "updatedAt" desc
         limit 1`,
        [bannedDiscordUserId],
      );
      await pool.query(
        `insert into banned_users (
           "discordUserId",
           "discordUsername",
           "bannedByDiscordUserId",
           "bannedByDiscordUsername"
         )
         values ($1, $2, $3, $4)
         on conflict ("discordUserId")
         do update set
           "discordUsername" = coalesce(banned_users."discordUsername", excluded."discordUsername"),
           "bannedByDiscordUserId" = coalesce(banned_users."bannedByDiscordUserId", excluded."bannedByDiscordUserId"),
           "bannedByDiscordUsername" = coalesce(banned_users."bannedByDiscordUsername", excluded."bannedByDiscordUsername")`,
        [
          bannedDiscordUserId,
          latestUserReport.rows[0]?.discordusername ?? null,
          currentUser.discordUserId,
          currentUser.username,
        ],
      );

      return Response.json({ success: true, isAdmin: true, bannedUsers: await getBannedUsers() });
    } catch (error) {
      return databaseErrorResponse(error, {
        action: "ban-user",
        discordUserId: currentUser.discordUserId,
        bannedDiscordUserId,
      });
    }
  }

  if (body?.action === "unbanUser") {
    if (!isAdminSessionUserId(currentUser.sessionUserId)) {
      return Response.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
    }

    const unbannedDiscordUserId = typeof body.discordUserId === "string" ? body.discordUserId.trim() : "";
    if (!unbannedDiscordUserId) {
      return Response.json({ error: "INVALID_UNBAN" }, { status: 400 });
    }
    if (unbannedDiscordUserId === currentUser.discordUserId || unbannedDiscordUserId === currentUser.sessionUserId) {
      return Response.json({ error: "CANNOT_UNBAN_SELF" }, { status: 400 });
    }

    try {
      const pool = getPool();
      await ensureModerationTables(pool);
      await pool.query(
        `delete from banned_users
         where "discordUserId" = $1`,
        [unbannedDiscordUserId],
      );

      return Response.json({ success: true, isAdmin: true, bannedUsers: await getBannedUsers() });
    } catch (error) {
      return databaseErrorResponse(error, {
        action: "unban-user",
        discordUserId: currentUser.discordUserId,
        unbannedDiscordUserId,
      });
    }
  }

  const zoneName = typeof body?.zoneName === "string" ? body.zoneName.trim() : "";
  const bonus = body?.bonus;

  if (!zoneName || !isBonusType(bonus)) {
    return Response.json({ error: "INVALID_REPORT" }, { status: 400 });
  }

  let client: PoolClient | undefined;

  try {
    client = await getPool().connect();
    await client.query("begin");
    await ensureModerationTables(client);

    if (await isBannedUser(client, currentUser.discordUserId)) {
      await client.query("rollback");
      return Response.json({ error: "USER_BANNED" }, { status: 403 });
    }

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
      isAdmin: isAdminSessionUserId(currentUser.sessionUserId),
      bannedUsers: isAdminSessionUserId(currentUser.sessionUserId) ? await getBannedUsers() : [],
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

export async function DELETE(request: Request) {
  const currentUser = await getDiscordSessionUser();
  if (!currentUser) {
    return Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const url = new URL(request.url);
  const body = await request.json().catch(() => null) as { id?: unknown; zoneName?: unknown } | null;
  const reportId = (url.searchParams.get("id") ?? (typeof body?.id === "string" ? body.id : "")).trim();
  const zoneName = (url.searchParams.get("zoneName") ?? (typeof body?.zoneName === "string" ? body.zoneName : "")).trim();
  const isAdmin = isAdminSessionUserId(currentUser.sessionUserId);

  if (!reportId && !zoneName) {
    return Response.json({ error: "INVALID_REPORT" }, { status: 400 });
  }

  try {
    const pool = getPool();
    if (isAdmin) {
      await ensureModerationTables(pool);
    }
    const deletedReport = reportId
      ? await pool.query<{ id: string }>(
          `delete from bonus_reports
           where id = $1
             and ($2 = true or "discordUserId" = $3)
           returning id`,
          [reportId, isAdmin, currentUser.discordUserId],
        )
      : await pool.query<{ id: string }>(
          `delete from bonus_reports
           where "zoneName" = $1
             and "discordUserId" = $2
           returning id`,
          [zoneName, currentUser.discordUserId],
        );

    if (deletedReport.rowCount === 0) {
      return Response.json({ error: "REPORT_NOT_FOUND" }, { status: 404 });
    }

    const reports = await getAllReports();
    return Response.json({
      success: true,
      reports,
      currentUserReports: getCurrentUserReports(reports, currentUser.discordUserId),
      isAdmin,
      bannedUsers: isAdmin ? await getBannedUsers() : [],
    });
  } catch (error) {
    return databaseErrorResponse(error, {
      action: "delete-report",
      reportId,
      zoneName,
      discordUserId: currentUser.discordUserId,
    });
  }
}
