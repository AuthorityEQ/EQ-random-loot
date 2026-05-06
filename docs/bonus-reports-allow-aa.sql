-- Run in the Supabase SQL editor to allow AA Bonus reports.
ALTER TABLE public.bonus_reports DROP CONSTRAINT IF EXISTS bonus_reports_bonus_check;

ALTER TABLE public.bonus_reports
ADD CONSTRAINT bonus_reports_bonus_check
CHECK (bonus IN ('Experience', 'AA', 'Coin', 'Loot', 'Rare', 'Skill', 'Respawn', 'Faction'));
