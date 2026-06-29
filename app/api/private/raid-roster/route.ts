import { getServerSession } from "next-auth";
import { Pool } from "pg";
import { authOptions } from "@/lib/auth";

let pool: Pool | undefined;

type RosterResponseRow = {
  roster: unknown;
  updatedAt: string;
  updatedByDiscordUserId: string | null;
  updatedByDiscordUsername: string | null;
};

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for private roster storage.");
  }

  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

function allowedDiscordIds() {
  return [
    process.env.ADMIN_DISCORD_ID,
    ...(process.env.PRIVATE_ROSTER_DISCORD_IDS ?? "").split(","),
  ]
    .map((id) => id?.trim())
    .filter((id): id is string => Boolean(id));
}

async function getAllowedUser() {
  const session = await getServerSession(authOptions);
  const discordUserId = session?.user?.discordUserId ?? session?.user?.id;

  if (!discordUserId) {
    return { error: Response.json({ error: "AUTH_REQUIRED" }, { status: 401 }) };
  }

  if (!allowedDiscordIds().includes(discordUserId)) {
    return { error: Response.json({ error: "FORBIDDEN" }, { status: 403 }) };
  }

  return {
    user: {
      discordUserId,
      discordUsername: session?.user?.discordUsername ?? session?.user?.name ?? null,
    },
  };
}

async function ensureTable() {
  await getPool().query(`
    create table if not exists public.private_raid_rosters (
      "rosterKey" text primary key,
      roster jsonb not null default '{"accounts":[]}'::jsonb,
      "updatedByDiscordUserId" text,
      "updatedByDiscordUsername" text,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now()
    )
  `);
}

function databaseErrorResponse(error: unknown) {
  console.error("[private-raid-roster] Database operation failed", {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    error,
  });
  return Response.json({ error: "DATABASE_ERROR" }, { status: 503 });
}

function isRosterPayload(value: unknown) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Array.isArray((value as { accounts?: unknown }).accounts)
  );
}

export async function GET() {
  const access = await getAllowedUser();
  if (access.error) return access.error;

  try {
    await ensureTable();
    const result = await getPool().query<RosterResponseRow>(
      `select roster,
              "updatedAt" as "updatedAt",
              "updatedByDiscordUserId" as "updatedByDiscordUserId",
              "updatedByDiscordUsername" as "updatedByDiscordUsername"
       from public.private_raid_rosters
       where "rosterKey" = 'default'`,
    );

    return Response.json({
      roster: result.rows[0]?.roster ?? { accounts: [] },
      updatedAt: result.rows[0]?.updatedAt ?? null,
      updatedByDiscordUserId: result.rows[0]?.updatedByDiscordUserId ?? null,
      updatedByDiscordUsername: result.rows[0]?.updatedByDiscordUsername ?? null,
    });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const access = await getAllowedUser();
  if (access.error) return access.error;

  const body = await request.json().catch(() => null) as { roster?: unknown } | null;
  const roster = body?.roster;
  if (!isRosterPayload(roster)) {
    return Response.json({ error: "INVALID_ROSTER" }, { status: 400 });
  }

  try {
    await ensureTable();
    const result = await getPool().query<RosterResponseRow>(
      `insert into public.private_raid_rosters as rosters
         ("rosterKey", roster, "updatedByDiscordUserId", "updatedByDiscordUsername")
       values ('default', $1::jsonb, $2, $3)
       on conflict ("rosterKey")
       do update set
         roster = excluded.roster,
         "updatedByDiscordUserId" = excluded."updatedByDiscordUserId",
         "updatedByDiscordUsername" = excluded."updatedByDiscordUsername",
         "updatedAt" = now()
       returning roster,
                 "updatedAt" as "updatedAt",
                 "updatedByDiscordUserId" as "updatedByDiscordUserId",
                 "updatedByDiscordUsername" as "updatedByDiscordUsername"`,
      [
        JSON.stringify(roster),
        access.user.discordUserId,
        access.user.discordUsername,
      ],
    );

    return Response.json({
      roster: result.rows[0]?.roster ?? roster,
      updatedAt: result.rows[0]?.updatedAt ?? null,
      updatedByDiscordUserId: result.rows[0]?.updatedByDiscordUserId ?? access.user.discordUserId,
      updatedByDiscordUsername: result.rows[0]?.updatedByDiscordUsername ?? access.user.discordUsername,
    });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
