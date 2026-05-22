-- =============================================================================
-- MIGRATION: "Account credentials" becomes the single source of truth
-- =============================================================================
-- Run each section in order. Verify after each before continuing.
-- DROP TABLE at the end is commented out — run it manually after verification.
--
-- ⚠️  BEFORE RUNNING:
--   The following users may not have a matching centific_email in
--   "Account credentials" and will need passwords set manually via
--   Admin → HC Overview → edit → Portal Access after migration:
--     Victor Fuentes, Shaik Shoeb Uman, Nurul Emilya,
--     Kirstie Simpson, Cristina Chicote, Ariadna Pascual Perez
-- =============================================================================


-- STEP 1: Add new columns to "Account credentials"
ALTER TABLE "Account credentials"
  ADD COLUMN IF NOT EXISTS position      TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;


-- STEP 2: Copy current role (job title) → position
-- Preserves "Annotator", "SME", "Language Lead", "Management" etc.
UPDATE "Account credentials"
SET position = role
WHERE position IS NULL;


-- STEP 3: Copy access role + password_hash from users table
-- Matches on centific_email (case-insensitive).
UPDATE "Account credentials" ac
SET
  role          = u.role,
  password_hash = u.password_hash
FROM users u
WHERE LOWER(ac.centific_email) = LOWER(u.email)
  AND u.password_hash IS NOT NULL;


-- STEP 4: Migrate user_id FK in availability_submissions
UPDATE availability_submissions avs
SET user_id = ac.id
FROM users u
JOIN "Account credentials" ac ON LOWER(u.email) = LOWER(ac.centific_email)
WHERE avs.user_id = u.id
  AND avs.user_id <> ac.id;


-- STEP 5: Migrate user_id FK in work_abroad_requests
UPDATE work_abroad_requests wa
SET user_id = ac.id
FROM users u
JOIN "Account credentials" ac ON LOWER(u.email) = LOWER(ac.centific_email)
WHERE wa.user_id = u.id
  AND wa.user_id <> ac.id;


-- STEP 6: Migrate user_id FK in submissions
UPDATE submissions s
SET user_id = ac.id
FROM users u
JOIN "Account credentials" ac ON LOWER(u.email) = LOWER(ac.centific_email)
WHERE s.user_id = u.id
  AND s.user_id <> ac.id;


-- =============================================================================
-- VERIFICATION — run these before dropping users.
-- All should return 0 rows (or only users you plan to fix manually).
-- =============================================================================

-- A: Active users with no password (cannot log in after migration)
SELECT id, name, centific_email
FROM "Account credentials"
WHERE status = 'Active'
  AND (password_hash IS NULL OR password_hash = '');

-- B: Orphaned availability_submissions
SELECT COUNT(*) AS orphaned_availability
FROM availability_submissions avs
WHERE NOT EXISTS (
  SELECT 1 FROM "Account credentials" ac WHERE ac.id = avs.user_id
);

-- C: Orphaned work_abroad_requests
SELECT COUNT(*) AS orphaned_work_abroad
FROM work_abroad_requests wa
WHERE NOT EXISTS (
  SELECT 1 FROM "Account credentials" ac WHERE ac.id = wa.user_id
);

-- D: Orphaned submissions
SELECT COUNT(*) AS orphaned_submissions
FROM submissions s
WHERE NOT EXISTS (
  SELECT 1 FROM "Account credentials" ac WHERE ac.id = s.user_id
);

-- E: Distinct role values (should be admin|lead|fte|freelancer only)
SELECT DISTINCT role FROM "Account credentials" ORDER BY role;


-- =============================================================================
-- STEP 7: Drop users table
-- ⚠️  Only after all verification queries return 0 / expected results.
-- =============================================================================
-- DROP TABLE users;
