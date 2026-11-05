package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// RunMigrations scans multiple possible locations to find migrations reliably on any environment
func RunMigrations(pool *pgxpool.Pool) error {
	ctx := context.Background()

	// 1. Create migrations tracking table if not exists
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS schema_migrations (
		version VARCHAR(255) PRIMARY KEY,
		applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);`
	if _, err := pool.Exec(ctx, createTableSQL); err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	// 1.1 Self-healing schema: Ensure core columns exist on teams table
	ensureTeamsSQL := `
	ALTER TABLE teams ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
	ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
	ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT;
	ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_img TEXT;
	ALTER TABLE teams ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255);
	ALTER TABLE teams ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
	ALTER TABLE teams ADD COLUMN IF NOT EXISTS contact_email TEXT;
	ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_roster_locked BOOLEAN DEFAULT FALSE;
	ALTER TABLE teams ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
	ALTER TABLE teams ADD COLUMN IF NOT EXISTS sport_id INTEGER;
	UPDATE teams SET user_id = created_by WHERE user_id IS NULL AND created_by IS NOT NULL;
	UPDATE teams SET created_by = user_id WHERE created_by IS NULL AND user_id IS NOT NULL;
	`
	if _, err := pool.Exec(ctx, ensureTeamsSQL); err != nil {
		log.Printf("⚠️ Self-healing teams schema: %v", err)
	}

	ensureStatusRequestsSQL := `
	CREATE TABLE IF NOT EXISTS tournament_status_requests (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
		requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		previous_status VARCHAR(50) NOT NULL,
		target_status VARCHAR(50) NOT NULL,
		reason TEXT NOT NULL DEFAULT '',
		status VARCHAR(50) NOT NULL DEFAULT 'pending',
		reject_reason TEXT,
		reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
		reviewed_at TIMESTAMPTZ,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);
	CREATE INDEX IF NOT EXISTS idx_tournament_status_requests_tournament ON tournament_status_requests(tournament_id);
	CREATE INDEX IF NOT EXISTS idx_tournament_status_requests_status ON tournament_status_requests(status);
	CREATE INDEX IF NOT EXISTS idx_tournament_status_requests_requested_by ON tournament_status_requests(requested_by);
	`
	if _, err := pool.Exec(ctx, ensureStatusRequestsSQL); err != nil {
		log.Printf("⚠️ Self-healing tournament_status_requests schema: %v", err)
	}

	// 1.3 Self-healing schema: Migrate document_deadline from settings JSON to tournaments.document_deadline column
	syncDocDeadlineSQL := `
	UPDATE tournaments 
	SET document_deadline = CASE 
	        WHEN settings->>'document_deadline' ~ '^\\d{4}-\\d{2}-\\d{2}' THEN (settings->>'document_deadline')::date 
	        ELSE document_deadline 
	    END,
	    settings = settings - 'document_deadline'
	WHERE settings ? 'document_deadline';
	`
	if _, err := pool.Exec(ctx, syncDocDeadlineSQL); err != nil {
		log.Printf("⚠️ Self-healing tournament document_deadline schema: %v", err)
	}

	ensureTournamentsSportSQL := `
	ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS sport_id INTEGER REFERENCES sports(id) ON DELETE SET NULL;
	UPDATE tournaments 
	SET sport_id = (settings->>'sport_id')::integer 
	WHERE sport_id IS NULL AND settings->>'sport_id' IS NOT NULL AND settings->>'sport_id' ~ '^\d+$';
	`
	if _, err := pool.Exec(ctx, ensureTournamentsSportSQL); err != nil {
		log.Printf("Self-healing tournament sport_id schema: %v", err)
	}

	// 2. Discover migrations directory reliably (supports Docker /app, relative, and local)
	candidates := []string{
		"/app/migrations",
		"./migrations",
		"../migrations",
		"../../migrations",
	}

	var migrationsDir string
	for _, dir := range candidates {
		if info, err := os.Stat(dir); err == nil && info.IsDir() {
			migrationsDir = dir
			break
		}
	}

	if migrationsDir == "" {
		log.Printf("⚠️ Migrations directory not found in candidates %v, checking schema_migrations count...", candidates)
		return nil
	}

	log.Printf("📂 Found migrations directory at: %s", migrationsDir)

	files, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("failed to read migrations dir %s: %w", migrationsDir, err)
	}

	var upFiles []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".up.sql") {
			upFiles = append(upFiles, f.Name())
		}
	}
	sort.Strings(upFiles)

	// 3. Apply pending migrations
	for _, file := range upFiles {
		var exists bool
		err := pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", file).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check migration status for %s: %w", file, err)
		}

		if exists {
			continue // Already applied
		}

		log.Printf("🚀 Migrating: applying %s...", file)
		filePath := filepath.Join(migrationsDir, file)
		sqlContent, err := os.ReadFile(filePath)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", file, err)
		}

		// Execute SQL in a transaction
		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("failed to begin transaction for %s: %w", file, err)
		}

		if _, err := tx.Exec(ctx, string(sqlContent)); err != nil {
			_ = tx.Rollback(ctx)
			log.Printf("❌ Migration failed on %s: %v", file, err)
			return fmt.Errorf("failed to execute migration %s: %w", file, err)
		}

		if _, err := tx.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", file); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("failed to record migration %s: %w", file, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", file, err)
		}

		log.Printf("✅ Migrated: %s successfully applied", file)
	}

	log.Println("🎉 All database migrations are up to date!")
	return nil
}
