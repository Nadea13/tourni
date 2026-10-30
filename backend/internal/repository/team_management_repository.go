package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"tourni-backend/internal/model"
)

type TeamManagementRepository struct {
	db *pgxpool.Pool
}

func NewTeamManagementRepository(db *pgxpool.Pool) *TeamManagementRepository {
	return &TeamManagementRepository{db: db}
}

func (r *TeamManagementRepository) CreateOrUpdate(ctx context.Context, req *model.TeamManagementRequest) error {
	// Check if existing request exists for this team and requester
	var existingID uuid.UUID
	var existingStatus string
	err := r.db.QueryRow(ctx, `
		SELECT id, status::text 
		FROM team_management_requests 
		WHERE team_id = $1 AND requester_id = $2
		LIMIT 1
	`, req.TeamID, req.RequesterID).Scan(&existingID, &existingStatus)

	if err == nil && existingID != uuid.Nil {
		// Update existing request
		query := `
			UPDATE team_management_requests
			SET contact_phone = $1,
			    message = $2,
			    status = 'pending',
			    updated_at = NOW()
			WHERE id = $3
			RETURNING id, status::text, created_at, updated_at
		`
		return r.db.QueryRow(ctx, query, req.ContactPhone, req.Message, existingID).
			Scan(&req.ID, &req.Status, &req.CreatedAt, &req.UpdatedAt)
	}

	// Insert new request
	query := `
		INSERT INTO team_management_requests (team_id, requester_id, contact_phone, message, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
		RETURNING id, status::text, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		req.TeamID, req.RequesterID, req.ContactPhone, req.Message,
	).Scan(&req.ID, &req.Status, &req.CreatedAt, &req.UpdatedAt)
}

func (r *TeamManagementRepository) GetByTeamAndRequester(ctx context.Context, teamID, requesterID uuid.UUID) (*model.TeamManagementRequest, error) {
	query := `
		SELECT id, team_id, requester_id, contact_phone, message, status::text, created_at, updated_at
		FROM team_management_requests
		WHERE team_id = $1 AND requester_id = $2
	`
	var req model.TeamManagementRequest
	err := r.db.QueryRow(ctx, query, teamID, requesterID).Scan(
		&req.ID, &req.TeamID, &req.RequesterID, &req.ContactPhone,
		&req.Message, &req.Status, &req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get team management request: %w", err)
	}
	return &req, nil
}

func (r *TeamManagementRepository) ListByRequester(ctx context.Context, requesterID uuid.UUID) ([]*model.TeamManagementRequest, error) {
	query := `
		SELECT tmr.id, tmr.team_id, tmr.requester_id, tmr.contact_phone, tmr.message, tmr.status::text, tmr.created_at, tmr.updated_at,
		       t.id, t.name, t.short_name, t.logo_url, t.logo_img, t.contact_email
		FROM team_management_requests tmr
		JOIN teams t ON tmr.team_id = t.id
		WHERE tmr.requester_id = $1
		ORDER BY tmr.updated_at DESC
	`
	rows, err := r.db.Query(ctx, query, requesterID)
	if err != nil {
		return nil, fmt.Errorf("failed to list requester management requests: %w", err)
	}
	defer rows.Close()

	var list []*model.TeamManagementRequest
	for rows.Next() {
		var req model.TeamManagementRequest
		var t model.Team
		if err := rows.Scan(
			&req.ID, &req.TeamID, &req.RequesterID, &req.ContactPhone, &req.Message, &req.Status, &req.CreatedAt, &req.UpdatedAt,
			&t.ID, &t.Name, &t.ShortName, &t.LogoURL, &t.LogoImg, &t.ContactEmail,
		); err != nil {
			return nil, err
		}
		req.Team = &t
		list = append(list, &req)
	}
	return list, nil
}

func (r *TeamManagementRepository) SearchTeamsForClaim(ctx context.Context, query string, excludeUserID *uuid.UUID) ([]*model.Team, error) {
	searchQuery := "%" + query + "%"
	sql := `
		SELECT t.id, t.name, t.short_name, t.description, t.logo_url, t.logo_img, t.contact_name, t.contact_email, t.created_at,
		       s.sport_name
		FROM teams t
		LEFT JOIN sports s ON t.sport_id = s.id
		WHERE t.deleted_at IS NULL
		  AND (t.name ILIKE $1 OR t.contact_email ILIKE $1 OR t.short_name ILIKE $1)
	`
	var args []interface{}
	args = append(args, searchQuery)

	if excludeUserID != nil && *excludeUserID != uuid.Nil {
		sql += " AND (t.user_id IS NULL OR t.user_id != $2)"
		args = append(args, *excludeUserID)
	}

	sql += " ORDER BY t.name ASC LIMIT 20"

	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to search teams for claim: %w", err)
	}
	defer rows.Close()

	var list []*model.Team
	for rows.Next() {
		var t model.Team
		var sportName *string
		if err := rows.Scan(
			&t.ID, &t.Name, &t.ShortName, &t.Description, &t.LogoURL, &t.LogoImg, &t.ContactName, &t.ContactEmail, &t.CreatedAt,
			&sportName,
		); err != nil {
			return nil, err
		}
		if sportName != nil {
			t.Sport = *sportName
		}
		list = append(list, &t)
	}
	return list, nil
}

func (r *TeamManagementRepository) ListIncoming(ctx context.Context, userID uuid.UUID) ([]*model.TeamManagementRequest, error) {
	var role string
	_ = r.db.QueryRow(ctx, `SELECT COALESCE(role::text, 'user') FROM users WHERE id = $1`, userID).Scan(&role)

	var query string
	var args []interface{}

	if role == "admin" || role == "super_admin" {
		// Admin sees all incoming requests (excluding ones they requested themselves)
		query = `
			SELECT tmr.id, tmr.team_id, tmr.requester_id, tmr.contact_phone, tmr.message, tmr.status::text, tmr.created_at, tmr.updated_at,
			       t.id, t.name, t.short_name, t.logo_url, t.logo_img, t.contact_email,
			       u.id, u.email, u.full_name, u.avatar_url, u.phone
			FROM team_management_requests tmr
			JOIN teams t ON tmr.team_id = t.id
			LEFT JOIN users u ON tmr.requester_id = u.id
			WHERE tmr.requester_id != $1
			ORDER BY tmr.updated_at DESC
		`
		args = append(args, userID)
	} else {
		// Non-admin sees requests for:
		// 1. Teams owned or created by user
		// 2. Teams in tournaments where user is organizer or collaborator
		// 3. Unassigned teams (t.user_id IS NULL) if user is organizer or staff
		query = `
			SELECT DISTINCT tmr.id, tmr.team_id, tmr.requester_id, tmr.contact_phone, tmr.message, tmr.status::text, tmr.created_at, tmr.updated_at,
			       t.id, t.name, t.short_name, t.logo_url, t.logo_img, t.contact_email,
			       u.id, u.email, u.full_name, u.avatar_url, u.phone
			FROM team_management_requests tmr
			JOIN teams t ON tmr.team_id = t.id
			LEFT JOIN users u ON tmr.requester_id = u.id
			WHERE tmr.requester_id != $1
			  AND (
			      t.user_id = $1
			      OR t.created_by = $1
			      OR t.id IN (
			          SELECT tt.team_id
			          FROM tournament_teams tt
			          JOIN tournament_categories tc ON (tt.tournament_category_id = tc.id OR tt.category_id = tc.id)
			          JOIN tournaments tour ON (tc.tournament_id = tour.id OR tt.tournament_id = tour.id)
			          LEFT JOIN tournament_invitations ti ON tour.id = ti.tournament_id AND ti.user_id = $1 AND ti.status = 'accepted' AND ti.deleted_at IS NULL
			          WHERE tt.deleted_at IS NULL
			            AND (tour.organizer_id = $1 OR ti.id IS NOT NULL)
			      )
			      OR (
			          t.user_id IS NULL
			          AND ($2 = 'organizer' OR $2 = 'staff' OR EXISTS (SELECT 1 FROM tournaments WHERE organizer_id = $1))
			      )
			  )
			ORDER BY tmr.updated_at DESC
		`
		args = append(args, userID, role)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list incoming team management requests: %w", err)
	}
	defer rows.Close()

	var list []*model.TeamManagementRequest
	for rows.Next() {
		var req model.TeamManagementRequest
		var t model.Team
		var u model.User
		var uAvatar, uPhone *string
		if err := rows.Scan(
			&req.ID, &req.TeamID, &req.RequesterID, &req.ContactPhone, &req.Message, &req.Status, &req.CreatedAt, &req.UpdatedAt,
			&t.ID, &t.Name, &t.ShortName, &t.LogoURL, &t.LogoImg, &t.ContactEmail,
			&u.ID, &u.Email, &u.FullName, &uAvatar, &uPhone,
		); err != nil {
			return nil, err
		}
		u.AvatarURL = uAvatar
		u.Phone = uPhone
		req.Team = &t
		req.Requester = &u
		list = append(list, &req)
	}
	return list, nil
}

func (r *TeamManagementRepository) Approve(ctx context.Context, requestID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var teamID, requesterID uuid.UUID
	var status string
	err = tx.QueryRow(ctx, `
		SELECT team_id, requester_id, status::text
		FROM team_management_requests
		WHERE id = $1
		FOR UPDATE
	`, requestID).Scan(&teamID, &requesterID, &status)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("request not found")
		}
		return err
	}

	if status != "pending" {
		return fmt.Errorf("request is already processed")
	}

	// 1. Update request status to approved
	_, err = tx.Exec(ctx, `
		UPDATE team_management_requests
		SET status = 'approved', updated_at = NOW()
		WHERE id = $1
	`, requestID)
	if err != nil {
		return fmt.Errorf("failed to update request status: %w", err)
	}

	// 2. Transfer team ownership (user_id) to requester
	_, err = tx.Exec(ctx, `
		UPDATE teams
		SET user_id = $1, updated_at = NOW()
		WHERE id = $2
	`, requesterID, teamID)
	if err != nil {
		return fmt.Errorf("failed to update team ownership: %w", err)
	}

	return tx.Commit(ctx)
}

func (r *TeamManagementRepository) Reject(ctx context.Context, requestID uuid.UUID) error {
	var teamID, requesterID uuid.UUID
	err := r.db.QueryRow(ctx, `
		UPDATE team_management_requests
		SET status = 'rejected', updated_at = NOW()
		WHERE id = $1
		RETURNING team_id, requester_id
	`, requestID).Scan(&teamID, &requesterID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return fmt.Errorf("request not found")
		}
		return fmt.Errorf("failed to reject request: %w", err)
	}

	return nil
}

func (r *TeamManagementRepository) Cancel(ctx context.Context, id uuid.UUID, userID uuid.UUID, isAdmin bool) error {
	query := `
		UPDATE team_management_requests
		SET status = 'cancelled', updated_at = NOW()
		WHERE (id = $1 OR team_id = $1)
		  AND requester_id = $2
		  AND status = 'pending'
	`
	args := []interface{}{id, userID}
	if isAdmin {
		query = `
			UPDATE team_management_requests
			SET status = 'cancelled', updated_at = NOW()
			WHERE (id = $1 OR team_id = $1)
			  AND status = 'pending'
		`
		args = []interface{}{id}
	}

	res, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to cancel request: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("request not found or already processed")
	}
	return nil
}
