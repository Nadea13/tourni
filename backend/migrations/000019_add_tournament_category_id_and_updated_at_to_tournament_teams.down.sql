DROP TRIGGER IF EXISTS trg_sync_tournament_teams_category_ids ON tournament_teams;
DROP FUNCTION IF EXISTS sync_tournament_teams_category_ids;
DROP INDEX IF EXISTS idx_tournament_teams_tournament_category_id;
DROP INDEX IF EXISTS idx_tournament_teams_category_id;
ALTER TABLE tournament_teams DROP COLUMN IF EXISTS updated_at;
ALTER TABLE tournament_teams DROP COLUMN IF EXISTS tournament_category_id;
