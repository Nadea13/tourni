-- =========================================================================
-- Migration 000020: Add missing columns to master_players table
-- =========================================================================

ALTER TABLE master_players ADD COLUMN IF NOT EXISTS nickname VARCHAR(100);
ALTER TABLE master_players ADD COLUMN IF NOT EXISTS profile_img TEXT;
ALTER TABLE master_players ADD COLUMN IF NOT EXISTS preferred_hand VARCHAR(20);
ALTER TABLE master_players ADD COLUMN IF NOT EXISTS preferred_foot VARCHAR(20);
ALTER TABLE master_players ADD COLUMN IF NOT EXISTS first_name_th VARCHAR(255);
ALTER TABLE master_players ADD COLUMN IF NOT EXISTS middle_name_th VARCHAR(255);
ALTER TABLE master_players ADD COLUMN IF NOT EXISTS last_name_th VARCHAR(255);
ALTER TABLE master_players ADD COLUMN IF NOT EXISTS first_name_en VARCHAR(255);
ALTER TABLE master_players ADD COLUMN IF NOT EXISTS middle_name_en VARCHAR(255);
ALTER TABLE master_players ADD COLUMN IF NOT EXISTS last_name_en VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_master_players_nickname ON master_players(nickname);
