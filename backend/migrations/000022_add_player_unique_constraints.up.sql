-- =========================================================================
-- Migration 000022: Deduplicate players and enforce unique constraints
-- =========================================================================

-- 1. Deduplicate players with same (team_id, master_player_id)
WITH duplicates_master AS (
    SELECT id as dup_id,
           FIRST_VALUE(id) OVER (
               PARTITION BY team_id, master_player_id 
               ORDER BY created_at ASC, id ASC
           ) as keep_id,
           ROW_NUMBER() OVER (
               PARTITION BY team_id, master_player_id 
               ORDER BY created_at ASC, id ASC
           ) as rn
    FROM players
    WHERE deleted_at IS NULL AND master_player_id IS NOT NULL
)
UPDATE match_events me
SET player_id = d.keep_id
FROM duplicates_master d
WHERE me.player_id = d.dup_id AND d.rn > 1;

WITH duplicates_master AS (
    SELECT id as dup_id,
           FIRST_VALUE(id) OVER (
               PARTITION BY team_id, master_player_id 
               ORDER BY created_at ASC, id ASC
           ) as keep_id,
           ROW_NUMBER() OVER (
               PARTITION BY team_id, master_player_id 
               ORDER BY created_at ASC, id ASC
           ) as rn
    FROM players
    WHERE deleted_at IS NULL AND master_player_id IS NOT NULL
)
UPDATE tournament_roster_submissions trs
SET player_id = d.keep_id
FROM duplicates_master d
WHERE trs.player_id = d.dup_id AND d.rn > 1;

WITH duplicates_master AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY team_id, master_player_id 
               ORDER BY created_at ASC, id ASC
           ) as rn
    FROM players
    WHERE deleted_at IS NULL AND master_player_id IS NOT NULL
)
DELETE FROM players
WHERE id IN (SELECT id FROM duplicates_master WHERE rn > 1);

-- 2. Deduplicate players with same (team_id, first_name, last_name)
WITH duplicates_name AS (
    SELECT id as dup_id,
           FIRST_VALUE(id) OVER (
               PARTITION BY team_id, LOWER(TRIM(first_name)), LOWER(TRIM(COALESCE(last_name, ''))) 
               ORDER BY created_at ASC, id ASC
           ) as keep_id,
           ROW_NUMBER() OVER (
               PARTITION BY team_id, LOWER(TRIM(first_name)), LOWER(TRIM(COALESCE(last_name, ''))) 
               ORDER BY created_at ASC, id ASC
           ) as rn
    FROM players
    WHERE deleted_at IS NULL
)
UPDATE match_events me
SET player_id = d.keep_id
FROM duplicates_name d
WHERE me.player_id = d.dup_id AND d.rn > 1;

WITH duplicates_name AS (
    SELECT id as dup_id,
           FIRST_VALUE(id) OVER (
               PARTITION BY team_id, LOWER(TRIM(first_name)), LOWER(TRIM(COALESCE(last_name, ''))) 
               ORDER BY created_at ASC, id ASC
           ) as keep_id,
           ROW_NUMBER() OVER (
               PARTITION BY team_id, LOWER(TRIM(first_name)), LOWER(TRIM(COALESCE(last_name, ''))) 
               ORDER BY created_at ASC, id ASC
           ) as rn
    FROM players
    WHERE deleted_at IS NULL
)
UPDATE tournament_roster_submissions trs
SET player_id = d.keep_id
FROM duplicates_name d
WHERE trs.player_id = d.dup_id AND d.rn > 1;

WITH duplicates_name AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY team_id, LOWER(TRIM(first_name)), LOWER(TRIM(COALESCE(last_name, ''))) 
               ORDER BY created_at ASC, id ASC
           ) as rn
    FROM players
    WHERE deleted_at IS NULL
)
DELETE FROM players
WHERE id IN (SELECT id FROM duplicates_name WHERE rn > 1);

-- 3. Deduplicate tournament_players with same (tournament_team_id, master_player_id)
WITH duplicates_tp AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY tournament_team_id, master_player_id 
               ORDER BY created_at ASC, id ASC
           ) as rn
    FROM tournament_players
    WHERE deleted_at IS NULL
)
DELETE FROM tournament_players
WHERE id IN (SELECT id FROM duplicates_tp WHERE rn > 1);

-- 4. Create Partial Unique Indexes to prevent any future duplicate records
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_unique_team_master
ON players (team_id, master_player_id)
WHERE deleted_at IS NULL AND master_player_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_unique_team_name
ON players (team_id, LOWER(TRIM(first_name)), LOWER(TRIM(COALESCE(last_name, ''))))
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_players_unique_team_master
ON tournament_players (tournament_team_id, master_player_id)
WHERE deleted_at IS NULL;
