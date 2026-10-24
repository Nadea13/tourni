-- =========================================================================
-- Migration 000019: Add tournament_category_id and updated_at to tournament_teams
-- =========================================================================

ALTER TABLE tournament_teams ADD COLUMN IF NOT EXISTS tournament_category_id UUID REFERENCES tournament_categories(id) ON DELETE CASCADE;
ALTER TABLE tournament_teams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE tournament_teams SET tournament_category_id = category_id WHERE tournament_category_id IS NULL AND category_id IS NOT NULL;
UPDATE tournament_teams SET category_id = tournament_category_id WHERE category_id IS NULL AND tournament_category_id IS NOT NULL;
UPDATE tournament_teams SET updated_at = created_at WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tournament_teams_category_id ON tournament_teams(category_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament_category_id ON tournament_teams(tournament_category_id);

CREATE OR REPLACE FUNCTION sync_tournament_teams_category_ids()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.category_id IS NULL AND NEW.tournament_category_id IS NOT NULL THEN
        NEW.category_id := NEW.tournament_category_id;
    ELSIF NEW.tournament_category_id IS NULL AND NEW.category_id IS NOT NULL THEN
        NEW.tournament_category_id := NEW.category_id;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_tournament_teams_category_ids ON tournament_teams;
CREATE TRIGGER trg_sync_tournament_teams_category_ids
BEFORE INSERT OR UPDATE ON tournament_teams
FOR EACH ROW EXECUTE FUNCTION sync_tournament_teams_category_ids();
