-- Down migration for 000019
DROP INDEX IF EXISTS idx_players_master_player_id;
ALTER TABLE players DROP COLUMN IF EXISTS master_player_id;

DROP INDEX IF EXISTS idx_roster_submissions_deleted_at;
DROP INDEX IF EXISTS idx_roster_submissions_player;
DROP INDEX IF EXISTS idx_roster_submissions_master_player;
ALTER TABLE tournament_roster_submissions DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE tournament_roster_submissions DROP COLUMN IF EXISTS rejection_reason;
ALTER TABLE tournament_roster_submissions DROP COLUMN IF EXISTS player_id;
ALTER TABLE tournament_roster_submissions DROP COLUMN IF EXISTS master_player_id;

DROP INDEX IF EXISTS idx_tournament_players_deleted_at;
ALTER TABLE tournament_players DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE tournament_players DROP COLUMN IF EXISTS updated_at;
