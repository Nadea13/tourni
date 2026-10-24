-- =========================================================================
-- Migration 000019: Add master_player_id to players and missing roster columns
-- =========================================================================

-- 1. Players table updates
ALTER TABLE players ADD COLUMN IF NOT EXISTS master_player_id UUID REFERENCES master_players(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_players_master_player_id ON players(master_player_id);

-- 2. Tournament Roster Submissions table updates
ALTER TABLE tournament_roster_submissions ADD COLUMN IF NOT EXISTS master_player_id UUID REFERENCES master_players(id) ON DELETE SET NULL;
ALTER TABLE tournament_roster_submissions ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE tournament_roster_submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE tournament_roster_submissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_roster_submissions_master_player ON tournament_roster_submissions(master_player_id);
CREATE INDEX IF NOT EXISTS idx_roster_submissions_player ON tournament_roster_submissions(player_id);
CREATE INDEX IF NOT EXISTS idx_roster_submissions_deleted_at ON tournament_roster_submissions(deleted_at);

-- 3. Tournament Players table updates
ALTER TABLE tournament_players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE tournament_players ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tournament_players_deleted_at ON tournament_players(deleted_at);
