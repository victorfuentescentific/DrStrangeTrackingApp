-- ============================================================================
-- migrate-hc-source-of-truth.sql
-- Dr Strange Portal — Consolidate to accounts_credentials as single source of truth
-- ============================================================================
--
-- !! WARNING — READ BEFORE RUNNING !!
-- ============================================================================
-- Execute this script in TWO phases:
--
--   PHASE 1 (Steps 1–5): Safe data migration — run all of these first.
--   PHASE 2 (Step 6):    DROP TABLE users — run ONLY after VERIFICATION
--                         block (Step 5) confirms zero rows returned.
--
-- Special case — Management users:
--   The following 6 users may not have a matching centific_email in
--   accounts_credentials and will be left without a password_hash after
--   Phase 1. After completing the migration, use the Admin HC page to
--   manually reset their passwords:
--     - Victor Fuentes
--     - Shaik Shoeb Uman
--     - Nurul Emilya
--     - Kirstie Simpson
--     - Cristina Chicote
--     - Ariadna Pascual Perez
-- ============================================================================


-- ============================================================================
-- STEP 1: Add new columns to accounts_credentials (safe, idempotent)
-- ============================================================================

-- position: stores the job-title that was held in accounts_credentials.role
--           (e.g. "Annotator", "SME") before role is repurposed for access level.
ALTER TABLE accounts_credentials
  ADD COLUMN IF NOT EXISTS position TEXT;

-- password_hash: BCrypt hash used for portal authentication (migrated from users).
ALTER TABLE accounts_credentials
  ADD COLUMN IF NOT EXISTS password_hash TEXT;


-- ============================================================================
-- STEP 2: Preserve existing job-title values before overwriting role
-- ============================================================================

-- Copy the current role column (job title strings) into the new position column.
-- Only update rows where position is not already set, so the step is re-runnable.
UPDATE accounts_credentials
SET    position = role
WHERE  position IS NULL
  AND  role IS NOT NULL;


-- ============================================================================
-- STEP 3: Copy password_hash and access-level role from users
--         Joined on LOWER(centific_email) = LOWER(users.email)
-- ============================================================================

UPDATE accounts_credentials ac
SET
    password_hash = u.password_hash,
    role          = u.role          -- overwrites job-title with access level
                                    -- (admin | lead | fte | freelancer)
FROM users u
WHERE LOWER(ac.centific_email) = LOWER(u.email)
  AND u.password_hash IS NOT NULL;  -- only copy where a hash actually exists


-- ============================================================================
-- STEP 4: Migrate foreign-key references in dependent tables
--         Each table's user_id is matched via the same email join, then
--         replaced with the corresponding accounts_credentials.id.
-- ============================================================================

-- 4a. availability_submissions -----------------------------------------------
UPDATE availability_submissions avs
SET    user_id = ac.id
FROM   users u
JOIN   accounts_credentials ac
       ON LOWER(ac.centific_email) = LOWER(u.email)
WHERE  avs.user_id = u.id
  AND  avs.user_id <> ac.id;  -- skip rows that already point to ac.id

-- 4b. work_abroad ------------------------------------------------------------
UPDATE work_abroad wa
SET    user_id = ac.id
FROM   users u
JOIN   accounts_credentials ac
       ON LOWER(ac.centific_email) = LOWER(u.email)
WHERE  wa.user_id = u.id
  AND  wa.user_id <> ac.id;

-- 4c. submissions ------------------------------------------------------------
UPDATE submissions s
SET    user_id = ac.id
FROM   users u
JOIN   accounts_credentials ac
       ON LOWER(ac.centific_email) = LOWER(u.email)
WHERE  s.user_id = u.id
  AND  s.user_id <> ac.id;


-- ============================================================================
-- STEP 5: VERIFICATION — run these SELECT statements before Step 6.
--         Every query below MUST return 0 rows before you proceed.
-- ============================================================================

-- CHECK A: Active accounts_credentials rows with no password_hash.
--          These users will be unable to log in after the users table is dropped.
--          (Management users listed above are the expected exceptions — reset
--           their passwords via the Admin HC page.)
SELECT
    id,
    name,
    centific_email,
    role,
    status
FROM   accounts_credentials
WHERE  status  = 'Active'
  AND  password_hash IS NULL
ORDER BY name;

-- CHECK B: availability_submissions rows still pointing to a users.id that has
--          no matching accounts_credentials record (would become orphaned).
SELECT avs.*
FROM   availability_submissions avs
WHERE  NOT EXISTS (
    SELECT 1 FROM accounts_credentials ac WHERE ac.id = avs.user_id
)
  AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = avs.user_id
);

-- CHECK C: work_abroad rows still pointing to an unmigrated users.id.
SELECT wa.*
FROM   work_abroad wa
WHERE  NOT EXISTS (
    SELECT 1 FROM accounts_credentials ac WHERE ac.id = wa.user_id
)
  AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = wa.user_id
);

-- CHECK D: submissions rows still pointing to an unmigrated users.id.
SELECT s.*
FROM   submissions s
WHERE  NOT EXISTS (
    SELECT 1 FROM accounts_credentials ac WHERE ac.id = s.user_id
)
  AND EXISTS (
    SELECT 1 FROM users u WHERE u.id = s.user_id
);

-- CHECK E: Sanity — confirm accounts_credentials now holds access-level roles.
--          You should see only: admin, lead, fte, freelancer (plus any NULLs for
--          unmatched rows that had no users record).
SELECT role, COUNT(*) AS count
FROM   accounts_credentials
GROUP  BY role
ORDER  BY role;


-- ============================================================================
-- STEP 6: DROP the users table
--
-- !! DO NOT RUN until ALL verification queries in Step 5 return 0 rows !!
-- !! After dropping, reset passwords for the 6 management users via the  !!
-- !! Admin HC page.                                                        !!
-- ============================================================================

-- DROP TABLE users;
