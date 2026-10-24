-- Down migration for 000020
DROP INDEX IF EXISTS idx_master_players_nickname;
ALTER TABLE master_players DROP COLUMN IF EXISTS last_name_en;
ALTER TABLE master_players DROP COLUMN IF EXISTS middle_name_en;
ALTER TABLE master_players DROP COLUMN IF EXISTS first_name_en;
ALTER TABLE master_players DROP COLUMN IF EXISTS last_name_th;
ALTER TABLE master_players DROP COLUMN IF EXISTS middle_name_th;
ALTER TABLE master_players DROP COLUMN IF EXISTS first_name_th;
ALTER TABLE master_players DROP COLUMN IF EXISTS preferred_foot;
ALTER TABLE master_players DROP COLUMN IF EXISTS preferred_hand;
ALTER TABLE master_players DROP COLUMN IF EXISTS profile_img;
ALTER TABLE master_players DROP COLUMN IF EXISTS nickname;
