-- Optional Supabase setup for Discord-backed user progress and preferences.
-- The app also creates this table lazily, but running this up front avoids first-write setup latency.
CREATE TABLE IF NOT EXISTS public.user_settings (
  "discordUserId" text PRIMARY KEY,
  "epicProgress" jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- RLS for Discord-backed settings.
--
-- The Next.js API keeps its existing session checks, then sets this transaction-local
-- Postgres setting before reading or writing:
--   select set_config('app.discord_user_id', '<discord id>', true);
--
-- These policies make Postgres enforce the same ownership rule: a request can only
-- select, insert, or update the row whose "discordUserId" matches that authenticated
-- Discord id. Guest users never call this table; they remain on localStorage.
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_settings_select_own_row ON public.user_settings;
DROP POLICY IF EXISTS user_settings_insert_own_row ON public.user_settings;
DROP POLICY IF EXISTS user_settings_update_own_row ON public.user_settings;

CREATE POLICY user_settings_select_own_row
ON public.user_settings
FOR SELECT
USING (
  "discordUserId" = NULLIF(current_setting('app.discord_user_id', true), '')
);

CREATE POLICY user_settings_insert_own_row
ON public.user_settings
FOR INSERT
WITH CHECK (
  "discordUserId" = NULLIF(current_setting('app.discord_user_id', true), '')
);

CREATE POLICY user_settings_update_own_row
ON public.user_settings
FOR UPDATE
USING (
  "discordUserId" = NULLIF(current_setting('app.discord_user_id', true), '')
)
WITH CHECK (
  "discordUserId" = NULLIF(current_setting('app.discord_user_id', true), '')
);
