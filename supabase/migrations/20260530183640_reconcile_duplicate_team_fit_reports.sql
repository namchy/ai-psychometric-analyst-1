-- Historical migration reconciliation marker.
--
-- Remote migration version 20260530183640 contains the same normalized SQL as:
-- 20260530110000_add_team_fit_reports.sql
--
-- The remote copy differs only by trailing whitespace.
-- This migration is intentionally a no-op so fresh environments do not
-- execute the team_fit_reports migration twice.

select 1;
