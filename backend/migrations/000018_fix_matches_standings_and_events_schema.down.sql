-- Down migration for 000018
DROP TRIGGER IF EXISTS trg_sync_matches_category_ids ON matches;
DROP FUNCTION IF EXISTS sync_matches_category_ids;
DROP TRIGGER IF EXISTS trg_sync_standings_category_ids ON standings;
DROP FUNCTION IF EXISTS sync_standings_category_ids;
DROP TRIGGER IF EXISTS trg_sync_match_events_columns ON match_events;
DROP FUNCTION IF EXISTS sync_match_events_columns;
