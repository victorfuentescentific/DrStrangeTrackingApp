-- migration-user-fields.sql
-- Run once in Supabase SQL editor to add new columns to the users table.
-- All columns are nullable and non-breaking — safe to run on a live database.

-- ── New profile / identity columns ───────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS emp_id              text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS v_microsoft_email   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ms_id               text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS one_forma_id        text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email      text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone               text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS shipping_address    text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS start_date          date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS batch               text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS centific_type       text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_designation    text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS billable            boolean;
ALTER TABLE users ADD COLUMN IF NOT EXISTS overall_status      text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ms_account_status   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_status        text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS laptop_status       text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bgc_request_date    date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bgc_status          text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_check_date date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS remarks             text;

-- ── Role check constraint — add 'lead' if not already present ────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'lead', 'fte', 'freelancer'));
