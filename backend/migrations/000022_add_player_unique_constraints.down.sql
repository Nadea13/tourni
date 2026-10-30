-- =========================================================================
-- Rollback Migration 000022: Drop player unique constraints
-- =========================================================================

DROP INDEX IF EXISTS idx_tournament_players_unique_team_master;
DROP INDEX IF EXISTS idx_players_unique_team_name;
DROP INDEX IF EXISTS idx_players_unique_team_master;
