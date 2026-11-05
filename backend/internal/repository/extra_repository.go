package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"tourni-backend/internal/model"
)

type ExtraRepository struct {
	db *pgxpool.Pool
}

func NewExtraRepository(db *pgxpool.Pool) *ExtraRepository {
	return &ExtraRepository{db: db}
}

// ================= Sports & Age Categories =================

func (r *ExtraRepository) ListSports(ctx context.Context) ([]*model.Sport, error) {
	query := `SELECT id, sport_name, sport_type, created_at, updated_at FROM sports WHERE deleted_at IS NULL AND LOWER(sport_name) IN ('football', 'volleyball', 'futsal') ORDER BY id ASC`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sports []*model.Sport
	for rows.Next() {
		var s model.Sport
		if err := rows.Scan(&s.ID, &s.SportName, &s.SportType, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		sports = append(sports, &s)
	}
	return sports, nil
}

func (r *ExtraRepository) ListAgeCategories(ctx context.Context) ([]*model.AgeCategory, error) {
	query := `SELECT id, category_name, min_age, max_age FROM age_categories ORDER BY id ASC`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*model.AgeCategory
	for rows.Next() {
		var ac model.AgeCategory
		if err := rows.Scan(&ac.ID, &ac.CategoryName, &ac.MinAge, &ac.MaxAge); err != nil {
			return nil, err
		}
		list = append(list, &ac)
	}
	return list, nil
}

func (r *ExtraRepository) GetOrCreateAgeCategory(ctx context.Context, name string, minAge, maxAge *int) (*model.AgeCategory, error) {
	var ac model.AgeCategory
	query := `SELECT id, category_name, min_age, max_age FROM age_categories WHERE LOWER(TRIM(category_name)) = LOWER(TRIM($1)) LIMIT 1`
	err := r.db.QueryRow(ctx, query, name).Scan(&ac.ID, &ac.CategoryName, &ac.MinAge, &ac.MaxAge)
	if err == nil {
		return &ac, nil
	}

	insertQuery := `
		INSERT INTO age_categories (category_name, min_age, max_age)
		VALUES ($1, $2, $3)
		RETURNING id, category_name, min_age, max_age
	`
	err = r.db.QueryRow(ctx, insertQuery, name, minAge, maxAge).Scan(&ac.ID, &ac.CategoryName, &ac.MinAge, &ac.MaxAge)
	if err != nil {
		err2 := r.db.QueryRow(ctx, query, name).Scan(&ac.ID, &ac.CategoryName, &ac.MinAge, &ac.MaxAge)
		if err2 == nil {
			return &ac, nil
		}
		return nil, fmt.Errorf("failed to create age category: %w", err)
	}
	return &ac, nil
}

// ================= Sponsors =================

func (r *ExtraRepository) ListSponsors(ctx context.Context, tournamentID uuid.UUID) ([]*model.TournamentSponsor, error) {
	query := `
		SELECT id, tournament_id, sponsor_name, logo_img, cover_url, link_url, order_index, created_at, updated_at
		FROM tournament_sponsors
		WHERE tournament_id = $1
		ORDER BY order_index ASC, created_at ASC
	`
	rows, err := r.db.Query(ctx, query, tournamentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*model.TournamentSponsor
	for rows.Next() {
		var s model.TournamentSponsor
		if err := rows.Scan(&s.ID, &s.TournamentID, &s.SponsorName, &s.LogoImg, &s.CoverURL, &s.LinkURL, &s.OrderIndex, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, &s)
	}
	return list, nil
}

func (r *ExtraRepository) CreateSponsor(ctx context.Context, s *model.TournamentSponsor) error {
	query := `
		INSERT INTO tournament_sponsors (tournament_id, sponsor_name, logo_img, cover_url, link_url, order_index)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query, s.TournamentID, s.SponsorName, s.LogoImg, s.CoverURL, s.LinkURL, s.OrderIndex).
		Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (r *ExtraRepository) UpdateSponsor(ctx context.Context, s *model.TournamentSponsor) error {
	query := `
		UPDATE tournament_sponsors
		SET sponsor_name = $1, logo_img = $2, cover_url = $3, link_url = $4, updated_at = NOW()
		WHERE id = $5
		RETURNING updated_at
	`
	return r.db.QueryRow(ctx, query, s.SponsorName, s.LogoImg, s.CoverURL, s.LinkURL, s.ID).Scan(&s.UpdatedAt)
}

func (r *ExtraRepository) DeleteSponsor(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM tournament_sponsors WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// ================= Announcements =================

func (r *ExtraRepository) ListAnnouncements(ctx context.Context, tournamentID uuid.UUID) ([]*model.Announcement, error) {
	query := `
		SELECT id, tournament_id, title, content, is_pinned, created_at, updated_at
		FROM announcements
		WHERE tournament_id = $1
		ORDER BY is_pinned DESC, created_at DESC
	`
	rows, err := r.db.Query(ctx, query, tournamentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*model.Announcement
	for rows.Next() {
		var a model.Announcement
		if err := rows.Scan(&a.ID, &a.TournamentID, &a.Title, &a.Content, &a.IsPinned, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, &a)
	}
	return list, nil
}

func (r *ExtraRepository) CreateAnnouncement(ctx context.Context, a *model.Announcement) error {
	query := `
		INSERT INTO announcements (tournament_id, title, content, is_pinned)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query, a.TournamentID, a.Title, a.Content, a.IsPinned).
		Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt)
}

func (r *ExtraRepository) DeleteAnnouncement(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM announcements WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *ExtraRepository) UpdateAnnouncement(ctx context.Context, id uuid.UUID, title, content *string, isPinned *bool) error {
	query := `
		UPDATE announcements
		SET title = COALESCE($1, title),
		    content = COALESCE($2, content),
		    is_pinned = COALESCE($3, is_pinned),
		    updated_at = NOW()
		WHERE id = $4
	`
	_, err := r.db.Exec(ctx, query, title, content, isPinned, id)
	return err
}

// ================= Invitations =================

func (r *ExtraRepository) ListInvitations(ctx context.Context, tournamentID uuid.UUID) ([]*model.TournamentInvitation, error) {
	query := `
		SELECT ti.id, ti.tournament_id, ti.user_id, ti.email, ti.role, ti.status, ti.created_at, ti.updated_at,
		       u.avatar_url, u.full_name
		FROM tournament_invitations ti
		LEFT JOIN users u ON (ti.user_id = u.id OR LOWER(ti.email) = LOWER(u.email))
		WHERE ti.tournament_id = $1
		ORDER BY ti.created_at DESC
	`
	rows, err := r.db.Query(ctx, query, tournamentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*model.TournamentInvitation
	for rows.Next() {
		var inv model.TournamentInvitation
		if err := rows.Scan(&inv.ID, &inv.TournamentID, &inv.UserID, &inv.Email, &inv.Role, &inv.Status, &inv.CreatedAt, &inv.UpdatedAt, &inv.AvatarURL, &inv.FullName); err != nil {
			return nil, err
		}
		list = append(list, &inv)
	}
	return list, nil
}

func (r *ExtraRepository) CreateInvitation(ctx context.Context, inv *model.TournamentInvitation) error {
	query := `
		INSERT INTO tournament_invitations (tournament_id, user_id, email, role, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`
	if inv.Status == "" {
		inv.Status = "pending"
	}
	return r.db.QueryRow(ctx, query, inv.TournamentID, inv.UserID, inv.Email, inv.Role, inv.Status).
		Scan(&inv.ID, &inv.CreatedAt, &inv.UpdatedAt)
}

func (r *ExtraRepository) UpdateInvitationRole(ctx context.Context, id uuid.UUID, role string) error {
	query := `
		UPDATE tournament_invitations
		SET role = $1, updated_at = NOW()
		WHERE id = $2
	`
	_, err := r.db.Exec(ctx, query, role, id)
	return err
}

func (r *ExtraRepository) DeleteInvitation(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM tournament_invitations WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *ExtraRepository) ListMyInvitations(ctx context.Context, userID uuid.UUID, email string) ([]*model.UserInvitationItem, error) {
	query := `
		SELECT ti.id, ti.tournament_id, ti.role, ti.status, ti.created_at,
		       tour.name, tour.logo_url
		FROM tournament_invitations ti
		JOIN tournaments tour ON ti.tournament_id = tour.id
		WHERE (ti.user_id = $1 OR (ti.email IS NOT NULL AND LOWER(ti.email) = LOWER($2)))
		ORDER BY ti.created_at DESC
	`
	rows, err := r.db.Query(ctx, query, userID, email)
	if err != nil {
		return nil, fmt.Errorf("failed to list user invitations: %w", err)
	}
	defer rows.Close()

	var list []*model.UserInvitationItem
	for rows.Next() {
		var item model.UserInvitationItem
		var tourLogo *string
		if err := rows.Scan(
			&item.ID, &item.TournamentID, &item.Role, &item.Status, &item.CreatedAt,
			&item.TournamentName, &tourLogo,
		); err != nil {
			return nil, err
		}
		item.TournamentLogo = tourLogo
		list = append(list, &item)
	}
	return list, nil
}

func (r *ExtraRepository) AcceptInvitation(ctx context.Context, tournamentID uuid.UUID, userID uuid.UUID, email string) error {
	query := `
		UPDATE tournament_invitations
		SET user_id = $1, status = 'accepted', updated_at = NOW()
		WHERE tournament_id = $2
		  AND (user_id = $1 OR (email IS NOT NULL AND LOWER(email) = LOWER($3)))
		  AND status = 'pending'
	`
	res, err := r.db.Exec(ctx, query, userID, tournamentID, email)
	if err != nil {
		return fmt.Errorf("failed to accept invitation: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("no pending invitation found")
	}
	return nil
}

func (r *ExtraRepository) RejectInvitation(ctx context.Context, tournamentID uuid.UUID, userID uuid.UUID, email string) error {
	query := `
		UPDATE tournament_invitations
		SET status = 'rejected', updated_at = NOW()
		WHERE tournament_id = $1
		  AND (user_id = $2 OR (email IS NOT NULL AND LOWER(email) = LOWER($3)))
		  AND status = 'pending'
	`
	res, err := r.db.Exec(ctx, query, tournamentID, userID, email)
	if err != nil {
		return fmt.Errorf("failed to reject invitation: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("no pending invitation found")
	}
	return nil
}

// ================= Payments =================

func (r *ExtraRepository) ListPayments(ctx context.Context, userID *uuid.UUID, tournamentID *uuid.UUID) ([]*model.Payment, error) {
	query := `
		SELECT id, user_id, tournament_id, team_id, amount, plan_name, payment_status,
		       payment_method, transaction_id, raw_gateway_response, paid_at, created_at
		FROM payments
		WHERE 1=1
	`
	var args []interface{}
	argIdx := 1

	if userID != nil {
		query += fmt.Sprintf(" AND user_id = $%d", argIdx)
		args = append(args, *userID)
		argIdx++
	}

	if tournamentID != nil {
		query += fmt.Sprintf(" AND tournament_id = $%d", argIdx)
		args = append(args, *tournamentID)
		argIdx++
	}

	query += " ORDER BY created_at DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*model.Payment
	for rows.Next() {
		var p model.Payment
		var rawBytes []byte
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.TournamentID, &p.TeamID, &p.Amount, &p.PlanName, &p.PaymentStatus,
			&p.PaymentMethod, &p.TransactionID, &rawBytes, &p.PaidAt, &p.CreatedAt,
		); err != nil {
			return nil, err
		}
		if len(rawBytes) > 0 {
			_ = json.Unmarshal(rawBytes, &p.RawGatewayResponse)
		}
		list = append(list, &p)
	}
	return list, nil
}

func (r *ExtraRepository) CreatePayment(ctx context.Context, p *model.Payment) error {
	if p.TransactionID != nil && *p.TransactionID != "" {
		var existingID uuid.UUID
		var existingCreatedAt time.Time
		err := r.db.QueryRow(ctx, `SELECT id, created_at FROM payments WHERE transaction_id = $1 LIMIT 1`, *p.TransactionID).Scan(&existingID, &existingCreatedAt)
		if err == nil {
			p.ID = existingID
			p.CreatedAt = existingCreatedAt
			return nil
		}
	}

	query := `
		INSERT INTO payments (user_id, tournament_id, team_id, amount, plan_name, payment_status,
		                     payment_method, transaction_id, raw_gateway_response, paid_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, NOW()))
		RETURNING id, created_at
	`
	rawBytes, _ := json.Marshal(p.RawGatewayResponse)
	err := r.db.QueryRow(ctx, query,
		p.UserID, p.TournamentID, p.TeamID, p.Amount, p.PlanName, p.PaymentStatus,
		p.PaymentMethod, p.TransactionID, rawBytes, p.PaidAt,
	).Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		return err
	}

	// Upgrade user role to organizer upon successful payment
	if p.UserID != nil && (p.PaymentStatus == "completed" || p.PaymentStatus == "success") {
		_, _ = r.db.Exec(ctx, `UPDATE users SET role = 'organizer', updated_at = NOW() WHERE id = $1 AND role = 'user'`, *p.UserID)
	}

	return nil
}

func (r *ExtraRepository) GetTableCounts(ctx context.Context) (*model.TableStats, error) {
	query := `
		SELECT 
			(SELECT COUNT(*) FROM users) AS users,
			(SELECT COUNT(*) FROM tournaments) AS tournaments,
			(SELECT COUNT(*) FROM teams) AS teams,
			(SELECT COUNT(*) FROM matches WHERE deleted_at IS NULL) AS matches,
			(SELECT COUNT(*) FROM payments) AS payments,
			(SELECT COUNT(*) FROM master_players WHERE deleted_at IS NULL) AS players
	`
	var stats model.TableStats
	err := r.db.QueryRow(ctx, query).Scan(
		&stats.Users,
		&stats.Tournaments,
		&stats.Teams,
		&stats.Matches,
		&stats.Payments,
		&stats.Players,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get table counts: %w", err)
	}
	return &stats, nil
}

func (r *ExtraRepository) GetTablePreview(ctx context.Context, table string) ([]map[string]interface{}, error) {
	var query string
	switch table {
	case "users":
		query = `SELECT id::text, full_name, email, role::text, created_at, deleted_at FROM users ORDER BY created_at DESC LIMIT 25`
	case "tournaments":
		query = `SELECT t.id::text, t.name, COALESCE(s.sport_name, 'Football') as sport_name, t.format, t.status, t.created_at, t.deleted_at FROM tournaments t LEFT JOIN sports s ON t.sport_id = s.id ORDER BY t.created_at DESC LIMIT 25`
	case "teams":
		query = `SELECT t.id::text, t.name, COALESCE(t.short_name, '') as short_name, COALESCE(s.sport_name, '') as sport_name, t.created_at, t.deleted_at FROM teams t LEFT JOIN sports s ON t.sport_id = s.id ORDER BY t.created_at DESC LIMIT 25`
	case "matches":
		query = `SELECT m.id::text, COALESCE(th.name, m.ph_home, 'TBD') as home_team, COALESCE(ta.name, m.ph_away, 'TBD') as away_team, m.home_score, m.away_score, m.status::text, m.stage, m.created_at FROM matches m LEFT JOIN teams th ON m.home_team_id = th.id LEFT JOIN teams ta ON m.away_team_id = ta.id WHERE m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 25`
	case "payments":
		query = `SELECT id::text, COALESCE(transaction_id, '') as transaction_id, plan_name, amount, payment_method, payment_status, created_at FROM payments ORDER BY created_at DESC LIMIT 25`
	case "players":
		query = `SELECT id::text, 
			COALESCE(
				NULLIF(TRIM(CONCAT(first_name_local, ' ', CASE WHEN last_name_local = '-' THEN '' ELSE last_name_local END)), ''),
				NULLIF(TRIM(CONCAT(first_name_intl, ' ', CASE WHEN last_name_intl = '-' THEN '' ELSE last_name_intl END)), ''),
				NULLIF(TRIM(CONCAT(first_name_th, ' ', last_name_th)), ''),
				NULLIF(TRIM(CONCAT(first_name_en, ' ', last_name_en)), ''),
				'Unknown'
			) as full_name,
			gender::text as gender,
			birthday::text as birthday,
			COALESCE(tel, '') as tel,
			status::text as status,
			created_at
		FROM master_players
		WHERE deleted_at IS NULL
		ORDER BY created_at DESC
		LIMIT 25`
	default:
		return nil, fmt.Errorf("invalid table name")
	}

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []map[string]interface{}
	fieldDescriptions := rows.FieldDescriptions()
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, err
		}
		item := make(map[string]interface{})
		for i, fd := range fieldDescriptions {
			item[string(fd.Name)] = values[i]
		}
		results = append(results, item)
	}
	if results == nil {
		results = []map[string]interface{}{}
	}
	return results, nil
}


