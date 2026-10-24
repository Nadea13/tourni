-- =========================================================================
-- Migration 000018: Add missing columns and compatibility aliases for matches, standings, and match_events
-- =========================================================================

-- 1. Matches Table Updates
ALTER TABLE matches ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES tournament_categories(id) ON DELETE CASCADE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_category_id UUID REFERENCES tournament_categories(id) ON DELETE CASCADE;
ALTER TABLE matches ALTER COLUMN stage_id DROP NOT NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round INT NOT NULL DEFAULT 1;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS stage VARCHAR(50) NOT NULL DEFAULT 'group';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS idx_match INT NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS timer_status VARCHAR(50) NOT NULL DEFAULT 'stopped';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS elapsed_seconds INT NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS minute INT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS node_id VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS next_node_id VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS ph_home VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS ph_away VARCHAR(255);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_detail JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_matches_category_id ON matches(category_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_category_id ON matches(tournament_category_id);
CREATE INDEX IF NOT EXISTS idx_matches_node_idx ON matches(category_id, node_id, idx_match) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION sync_matches_category_ids()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.category_id IS NULL AND NEW.tournament_category_id IS NOT NULL THEN
        NEW.category_id := NEW.tournament_category_id;
    ELSIF NEW.tournament_category_id IS NULL AND NEW.category_id IS NOT NULL THEN
        NEW.tournament_category_id := NEW.category_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_matches_category_ids ON matches;
CREATE TRIGGER trg_sync_matches_category_ids
BEFORE INSERT OR UPDATE ON matches
FOR EACH ROW EXECUTE FUNCTION sync_matches_category_ids();

-- 2. Standings Table Updates
ALTER TABLE standings ALTER COLUMN stage_id DROP NOT NULL;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS tournament_category_id UUID REFERENCES tournament_categories(id) ON DELETE CASCADE;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES tournament_categories(id) ON DELETE CASCADE;
ALTER TABLE standings ADD COLUMN IF NOT EXISTS node_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_standings_category ON standings(tournament_category_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_standings_category_group_team ON standings(tournament_category_id, group_name, team_id);

CREATE OR REPLACE FUNCTION sync_standings_category_ids()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.category_id IS NULL AND NEW.tournament_category_id IS NOT NULL THEN
        NEW.category_id := NEW.tournament_category_id;
    ELSIF NEW.tournament_category_id IS NULL AND NEW.category_id IS NOT NULL THEN
        NEW.tournament_category_id := NEW.category_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_standings_category_ids ON standings;
CREATE TRIGGER trg_sync_standings_category_ids
BEFORE INSERT OR UPDATE ON standings
FOR EACH ROW EXECUTE FUNCTION sync_standings_category_ids();

-- 3. Match Events Table Updates
ALTER TABLE match_events ALTER COLUMN event_type DROP NOT NULL;
ALTER TABLE match_events ALTER COLUMN extra_info DROP NOT NULL;
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS type VARCHAR(50);
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS detail JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE match_events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_match_events_type ON match_events(type);
CREATE INDEX IF NOT EXISTS idx_match_events_deleted_at ON match_events(deleted_at);

CREATE OR REPLACE FUNCTION sync_match_events_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type IS NULL AND NEW.event_type IS NOT NULL THEN
        NEW.type := NEW.event_type::text;
    ELSIF NEW.event_type IS NULL AND NEW.type IS NOT NULL THEN
        BEGIN
            NEW.event_type := NEW.type::match_event_type;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    IF (NEW.detail IS NULL OR NEW.detail = '{}'::jsonb) AND (NEW.extra_info IS NOT NULL AND NEW.extra_info <> '{}'::jsonb) THEN
        NEW.detail := NEW.extra_info;
    ELSIF (NEW.extra_info IS NULL OR NEW.extra_info = '{}'::jsonb) AND (NEW.detail IS NOT NULL AND NEW.detail <> '{}'::jsonb) THEN
        NEW.extra_info := NEW.detail;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_match_events_columns ON match_events;
CREATE TRIGGER trg_sync_match_events_columns
BEFORE INSERT OR UPDATE ON match_events
FOR EACH ROW EXECUTE FUNCTION sync_match_events_columns();
