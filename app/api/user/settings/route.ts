import { getServerSession } from "next-auth";
import { Pool, type PoolClient } from "pg";
import { authOptions } from "@/lib/auth";

let pool: Pool | undefined;

type UserSettings = {
  epicProgress: Record<string, unknown>;
  preferences: Record<string, unknown>;
};

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for user settings storage.");
  }

  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

async function ensureUserSettingsTable(client: Pool | PoolClient = getPool()) {
  await client.query(`
    create table if not exists public.user_settings (
      "discordUserId" text primary key,
      "epicProgress" jsonb not null default '{}'::jsonb,
      preferences jsonb not null default '{}'::jsonb,
      "createdAt" timestamptz not null default now(),
      "updatedAt" timestamptz not null default now()
    )
  `);
}

async function withDiscordUserContext<T>(
  discordUserId: string,
  operation: (client: PoolClient) => Promise<T>,
) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query("select set_config('app.discord_user_id', $1, true)", [discordUserId]);
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function emptySettings(): UserSettings {
  return { epicProgress: {}, preferences: {} };
}

async function getDiscordUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.discordUserId;
}

function databaseErrorResponse(error: unknown) {
  console.error("[user-settings] Database operation failed", {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    error,
  });
  return Response.json({ error: "DATABASE_ERROR" }, { status: 503 });
}

export async function GET() {
  const discordUserId = await getDiscordUserId();
  if (!discordUserId) {
    return Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  try {
    const settings = await withDiscordUserContext(
      discordUserId,
      async (client) => {
        await ensureUserSettingsTable(client);
        const result = await client.query<UserSettings>(
          `select "epicProgress", preferences
           from public.user_settings
           where "discordUserId" = $1`,
          [discordUserId],
        );
        return result.rows[0] ?? emptySettings();
      },
    );
    return Response.json({ settings });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const discordUserId = await getDiscordUserId();
  if (!discordUserId) {
    return Response.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as Partial<UserSettings> | null;
  const epicProgress = body?.epicProgress && typeof body.epicProgress === "object" ? body.epicProgress : null;
  const preferences = body?.preferences && typeof body.preferences === "object" ? body.preferences : null;

  if (!epicProgress && !preferences) {
    return Response.json({ error: "INVALID_SETTINGS" }, { status: 400 });
  }

  try {
    const settings = await withDiscordUserContext(
      discordUserId,
      async (client) => {
        await ensureUserSettingsTable(client);
        const result = await client.query<UserSettings>(
          `insert into public.user_settings as settings ("discordUserId", "epicProgress", preferences)
           values ($1, coalesce($2::jsonb, '{}'::jsonb), coalesce($3::jsonb, '{}'::jsonb))
           on conflict ("discordUserId")
           do update set
             "epicProgress" = case
               when $2::jsonb is null then settings."epicProgress"
               else excluded."epicProgress"
             end,
             preferences = case
               when $3::jsonb is null then settings.preferences
               else settings.preferences || excluded.preferences
             end,
             "updatedAt" = now()
           returning "epicProgress", preferences`,
          [
            discordUserId,
            epicProgress ? JSON.stringify(epicProgress) : null,
            preferences ? JSON.stringify(preferences) : null,
          ],
        );
        return result.rows[0] ?? emptySettings();
      },
    );
    return Response.json({ settings });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
