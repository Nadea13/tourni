package repository

import (
	"context"
	"fmt"
	"strings"
	"unicode"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"tourni-backend/internal/model"
)

type RegistrationRepository struct {
	db *pgxpool.Pool
}

func NewRegistrationRepository(db *pgxpool.Pool) *RegistrationRepository {
	return &RegistrationRepository{db: db}
}

func (r *RegistrationRepository) ListTournamentTeams(ctx context.Context, tournamentID *uuid.UUID, categoryID *uuid.UUID) ([]*model.TournamentTeam, error) {
	query := `
		SELECT tt.id, tt.tournament_id, tt.tournament_category_id, tt.team_id,
		       tt.payment_status, tt.registration_status, tt.roster_status, tt.is_roster_locked,
		       tt.unlock_requested, tt.slip_img, tt.contact_name, tt.contact_phone, tt.contact_email,
		       tt.remark, tt.seed_number, tt.group_name, tt.created_at, tt.updated_at,
		       t.id, t.name, t.short_name, t.logo_url, t.logo_img
		FROM tournament_teams tt
		JOIN teams t ON tt.team_id = t.id
		WHERE tt.deleted_at IS NULL
	`
	var args []interface{}
	argIdx := 1

	if tournamentID != nil {
		query += fmt.Sprintf(" AND tt.tournament_id = $%d", argIdx)
		args = append(args, *tournamentID)
		argIdx++
	}

	if categoryID != nil {
		query += fmt.Sprintf(" AND (tt.tournament_category_id = $%d OR tt.category_id = $%d)", argIdx, argIdx)
		args = append(args, *categoryID)
		argIdx++
	}

	query += " ORDER BY tt.created_at ASC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list tournament teams: %w", err)
	}
	defer rows.Close()

	var list []*model.TournamentTeam
	for rows.Next() {
		var tt model.TournamentTeam
		var t model.Team
		if err := rows.Scan(
			&tt.ID, &tt.TournamentID, &tt.TournamentCategoryID, &tt.TeamID,
			&tt.PaymentStatus, &tt.RegistrationStatus, &tt.RosterStatus, &tt.IsRosterLocked,
			&tt.UnlockRequested, &tt.SlipImg, &tt.ContactName, &tt.ContactPhone, &tt.ContactEmail,
			&tt.Remark, &tt.SeedNumber, &tt.GroupName, &tt.CreatedAt, &tt.UpdatedAt,
			&t.ID, &t.Name, &t.ShortName, &t.LogoURL, &t.LogoImg,
		); err != nil {
			return nil, err
		}
		tt.CategoryID = tt.TournamentCategoryID
		tt.Team = &t
		list = append(list, &tt)
	}
	return list, nil
}

func (r *RegistrationRepository) GetTournamentTeam(ctx context.Context, id uuid.UUID) (*model.TournamentTeam, error) {
	query := `
		SELECT tt.id, tt.tournament_id, tt.tournament_category_id, tt.team_id,
		       tt.payment_status, tt.registration_status, tt.roster_status, tt.is_roster_locked,
		       tt.unlock_requested, tt.slip_img, tt.contact_name, tt.contact_phone, tt.contact_email,
		       tt.remark, tt.seed_number, tt.group_name, tt.created_at, tt.updated_at,
		       t.id, t.name, t.short_name, t.logo_url, t.logo_img, t.user_id
		FROM tournament_teams tt
		JOIN teams t ON tt.team_id = t.id
		WHERE (tt.id = $1 OR tt.team_id = $1) AND tt.deleted_at IS NULL
		ORDER BY tt.created_at DESC
		LIMIT 1
	`
	var tt model.TournamentTeam
	var t model.Team
	err := r.db.QueryRow(ctx, query, id).Scan(
		&tt.ID, &tt.TournamentID, &tt.TournamentCategoryID, &tt.TeamID,
		&tt.PaymentStatus, &tt.RegistrationStatus, &tt.RosterStatus, &tt.IsRosterLocked,
		&tt.UnlockRequested, &tt.SlipImg, &tt.ContactName, &tt.ContactPhone, &tt.ContactEmail,
		&tt.Remark, &tt.SeedNumber, &tt.GroupName, &tt.CreatedAt, &tt.UpdatedAt,
		&t.ID, &t.Name, &t.ShortName, &t.LogoURL, &t.LogoImg, &t.UserID,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	tt.CategoryID = tt.TournamentCategoryID
	tt.Team = &t
	return &tt, nil
}

func (r *RegistrationRepository) RegisterTeam(ctx context.Context, tt *model.TournamentTeam) error {
	catID := tt.TournamentCategoryID
	if catID == uuid.Nil && tt.CategoryID != uuid.Nil {
		catID = tt.CategoryID
	}
	tt.TournamentCategoryID = catID
	tt.CategoryID = catID

	if tt.TournamentID == uuid.Nil && catID != uuid.Nil {
		var tID uuid.UUID
		err := r.db.QueryRow(ctx, `SELECT tournament_id FROM tournament_categories WHERE id = $1`, catID).Scan(&tID)
		if err == nil {
			tt.TournamentID = tID
		}
	}

	query := `
		INSERT INTO tournament_teams (tournament_id, category_id, tournament_category_id, team_id,
		                             payment_status, registration_status, roster_status, is_roster_locked,
		                             unlock_requested, slip_img, contact_name, contact_phone, contact_email,
		                             remark, seed_number, group_name)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		RETURNING id, created_at, updated_at
	`
	err := r.db.QueryRow(ctx, query,
		tt.TournamentID, catID, catID, tt.TeamID,
		tt.PaymentStatus, tt.RegistrationStatus, tt.RosterStatus, tt.IsRosterLocked,
		tt.UnlockRequested, tt.SlipImg, tt.ContactName, tt.ContactPhone, tt.ContactEmail,
		tt.Remark, tt.SeedNumber, tt.GroupName,
	).Scan(&tt.ID, &tt.CreatedAt, &tt.UpdatedAt)
	if err != nil {
		return err
	}

	// Automatically copy/sync players from the team to tournament_roster_submissions (pending)
	if tt.TeamID != uuid.Nil {
		_ = r.syncTeamPlayersToTournament(ctx, tt.ID, tt.TeamID)
	}

	return nil
}

func (r *RegistrationRepository) syncTeamPlayersToTournament(ctx context.Context, tournamentTeamID, teamID uuid.UUID) error {
	// 1. Ensure master_players records exist for any player in this team that doesn't have one
	ensureMasterQuery := `
		INSERT INTO master_players (first_name_local, last_name_local, birthday, photo_url, status, verified)
		SELECT p.first_name, COALESCE(NULLIF(p.last_name, ''), '-'), p.date_of_birth, p.photo_url, 'active', false
		FROM players p
		WHERE p.team_id = $1 AND p.master_player_id IS NULL AND p.deleted_at IS NULL
	`
	_, _ = r.db.Exec(ctx, ensureMasterQuery, teamID)

	// Link back newly created master_players if possible
	linkMasterQuery := `
		UPDATE players p
		SET master_player_id = mp.id
		FROM master_players mp
		WHERE p.team_id = $1 AND p.master_player_id IS NULL AND p.deleted_at IS NULL
		  AND mp.first_name_local = p.first_name
		  AND mp.deleted_at IS NULL
	`
	_, _ = r.db.Exec(ctx, linkMasterQuery, teamID)

	// 2. Insert into tournament_roster_submissions table (pending verification)
	insertSubQuery := `
		INSERT INTO tournament_roster_submissions (
			tournament_team_id, master_player_id, player_id, name, shirt_number, position, tel, photo_url, status
		)
		SELECT $1,
		       p.master_player_id,
		       p.id,
		       TRIM(CONCAT(p.first_name, ' ', COALESCE(NULLIF(p.last_name, '-'), ''))),
		       COALESCE(p.shirt_number, p.jersey_number::text), 
		       p.position,
		       mp.tel,
		       p.photo_url,
		       'pending'
		FROM players p
		LEFT JOIN master_players mp ON mp.id = p.master_player_id
		WHERE p.team_id = $2 
		  AND NOT EXISTS (
			  SELECT 1 FROM tournament_roster_submissions trs 
			  WHERE trs.tournament_team_id = $1 
			    AND (trs.player_id = p.id OR trs.name = TRIM(CONCAT(p.first_name, ' ', COALESCE(NULLIF(p.last_name, '-'), ''))))
			    AND trs.deleted_at IS NULL
		  )
	`
	_, err := r.db.Exec(ctx, insertSubQuery, tournamentTeamID, teamID)
	return err
}

func (r *RegistrationRepository) UpdateTournamentTeamStatus(ctx context.Context, id uuid.UUID, paymentStatus, registrationStatus, rosterStatus string) error {
	query := `
		UPDATE tournament_teams
		SET payment_status = COALESCE(NULLIF($1, ''), payment_status),
		    registration_status = COALESCE(NULLIF($2, ''), registration_status),
		    roster_status = COALESCE(NULLIF($3, ''), roster_status),
		    updated_at = NOW()
		WHERE id = $4
	`
	_, err := r.db.Exec(ctx, query, paymentStatus, registrationStatus, rosterStatus, id)
	return err
}

func (r *RegistrationRepository) WithdrawTournamentTeam(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE tournament_teams
		SET registration_status = 'rejected',
		    updated_at = NOW()
		WHERE id = $1 OR team_id = $1
	`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *RegistrationRepository) RequestUnlock(ctx context.Context, id uuid.UUID, remark string) error {
	query := `
		UPDATE tournament_teams
		SET unlock_requested = TRUE, remark = $1, updated_at = NOW()
		WHERE id = $2
	`
	_, err := r.db.Exec(ctx, query, remark, id)
	return err
}

func (r *RegistrationRepository) ApproveUnlock(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE tournament_teams
		SET unlock_requested = FALSE, is_roster_locked = FALSE, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *RegistrationRepository) RejectUnlock(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE tournament_teams
		SET unlock_requested = FALSE, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *RegistrationRepository) LockRoster(ctx context.Context, id uuid.UUID, locked bool) error {
	query := `
		UPDATE tournament_teams
		SET is_roster_locked = $1, updated_at = NOW()
		WHERE id = $2
	`
	_, err := r.db.Exec(ctx, query, locked, id)
	return err
}

func (r *RegistrationRepository) GetRosterSubmissions(ctx context.Context, tournamentTeamID uuid.UUID) ([]*model.TournamentRosterSubmission, error) {
	query := `
		SELECT id, tournament_team_id, master_player_id, player_id, name, shirt_number, position, tel, photo_url, status, rejection_reason, created_at, updated_at
		FROM tournament_roster_submissions
		WHERE tournament_team_id = $1 AND deleted_at IS NULL
		ORDER BY shirt_number ASC NULLS LAST, name ASC
	`
	rows, err := r.db.Query(ctx, query, tournamentTeamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*model.TournamentRosterSubmission
	for rows.Next() {
		var s model.TournamentRosterSubmission
		if err := rows.Scan(
			&s.ID, &s.TournamentTeamID, &s.MasterPlayerID, &s.PlayerID, &s.Name, &s.ShirtNumber, &s.Position, &s.Tel,
			&s.PhotoURL, &s.Status, &s.RejectionReason, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, &s)
	}
	return list, nil
}

func (r *RegistrationRepository) AddRosterSubmission(ctx context.Context, s *model.TournamentRosterSubmission) error {
	query := `
		INSERT INTO tournament_roster_submissions (
			tournament_team_id, master_player_id, player_id, name, shirt_number, position, tel, photo_url, status, rejection_reason
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at
	`
	if s.Status == "" {
		s.Status = "pending"
	}
	return r.db.QueryRow(ctx, query,
		s.TournamentTeamID, s.MasterPlayerID, s.PlayerID, s.Name, s.ShirtNumber, s.Position, s.Tel, s.PhotoURL, s.Status, s.RejectionReason,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (r *RegistrationRepository) DeleteRosterSubmission(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM tournament_roster_submissions WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// Tournament Players (tournament_players table)
func (r *RegistrationRepository) GetTournamentPlayers(ctx context.Context, tournamentTeamID uuid.UUID) ([]*model.TournamentPlayer, error) {
	query := `
		SELECT tp.id, tp.tournament_team_id, tp.master_player_id, tp.shirt_number, tp.position, tp.created_at, tp.updated_at,
		       mp.id, mp.user_id,
		       COALESCE(
		           NULLIF(TRIM(CONCAT(mp.first_name_local, ' ', CASE WHEN mp.last_name_local = '-' THEN '' ELSE mp.last_name_local END)), ''),
		           NULLIF(TRIM(CONCAT(mp.first_name_intl, ' ', CASE WHEN mp.last_name_intl = '-' THEN '' ELSE mp.last_name_intl END)), ''),
		           NULLIF(TRIM(CONCAT(mp.first_name_th, ' ', CASE WHEN mp.last_name_th = '-' THEN '' ELSE mp.last_name_th END)), ''),
		           NULLIF(TRIM(CONCAT(mp.first_name_en, ' ', CASE WHEN mp.last_name_en = '-' THEN '' ELSE mp.last_name_en END)), ''),
		           'Unnamed'
		       ) AS name,
		       mp.first_name_local, mp.middle_name_local, mp.last_name_local, mp.first_name_intl, mp.middle_name_intl, mp.last_name_intl,
		       mp.nickname, mp.birthday::text, mp.photo_url, mp.tel, mp.favorite_sport_id,
		       mp.preferred_hand, mp.preferred_foot, mp.created_at, mp.updated_at
		FROM tournament_players tp
		JOIN master_players mp ON tp.master_player_id = mp.id
		WHERE (
			tp.tournament_team_id = $1 
			OR tp.tournament_team_id IN (
				SELECT id FROM tournament_teams WHERE team_id = $1
			)
		) AND tp.deleted_at IS NULL AND mp.deleted_at IS NULL
		ORDER BY tp.shirt_number ASC NULLS LAST, tp.created_at ASC
	`
	rows, err := r.db.Query(ctx, query, tournamentTeamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*model.TournamentPlayer
	for rows.Next() {
		var tp model.TournamentPlayer
		var mp model.MasterPlayer
		if err := rows.Scan(
			&tp.ID, &tp.TournamentTeamID, &tp.MasterPlayerID, &tp.ShirtNumber, &tp.Position, &tp.CreatedAt, &tp.UpdatedAt,
			&mp.ID, &mp.UserID, &mp.Name,
			&mp.FirstNameLocal, &mp.MiddleNameLocal, &mp.LastNameLocal,
			&mp.FirstNameIntl, &mp.MiddleNameIntl, &mp.LastNameIntl,
			&mp.Nickname, &mp.Birthday, &mp.PhotoURL, &mp.Tel, &mp.FavoriteSportID,
			&mp.PreferredHand, &mp.PreferredFoot, &mp.CreatedAt, &mp.UpdatedAt,
		); err != nil {
			return nil, err
		}
		tp.MasterPlayer = &mp
		list = append(list, &tp)
	}
	return list, nil
}

func (r *RegistrationRepository) GetPlayersByTournament(ctx context.Context, tournamentID uuid.UUID, categoryID *uuid.UUID) ([]*model.TournamentPlayer, error) {
	query := `
		SELECT tp.id, tp.tournament_team_id, tp.master_player_id, tp.shirt_number, tp.position, tp.created_at, tp.updated_at,
		       mp.id, mp.user_id,
		       COALESCE(
		           NULLIF(TRIM(CONCAT(mp.first_name_local, ' ', CASE WHEN mp.last_name_local = '-' THEN '' ELSE mp.last_name_local END)), ''),
		           NULLIF(TRIM(CONCAT(mp.first_name_intl, ' ', CASE WHEN mp.last_name_intl = '-' THEN '' ELSE mp.last_name_intl END)), ''),
		           NULLIF(TRIM(CONCAT(mp.first_name_th, ' ', CASE WHEN mp.last_name_th = '-' THEN '' ELSE mp.last_name_th END)), ''),
		           NULLIF(TRIM(CONCAT(mp.first_name_en, ' ', CASE WHEN mp.last_name_en = '-' THEN '' ELSE mp.last_name_en END)), ''),
		           'Unnamed'
		       ) AS name,
		       mp.first_name_local, mp.middle_name_local, mp.last_name_local, mp.first_name_intl, mp.middle_name_intl, mp.last_name_intl,
		       mp.nickname, mp.birthday::text, mp.photo_url, mp.tel, mp.favorite_sport_id,
		       mp.preferred_hand, mp.preferred_foot, mp.created_at, mp.updated_at
		FROM tournament_players tp
		JOIN tournament_teams tt ON tp.tournament_team_id = tt.id
		JOIN master_players mp ON tp.master_player_id = mp.id
		WHERE tt.tournament_id = $1
		  AND ($2::uuid IS NULL OR tt.category_id = $2 OR tt.tournament_category_id = $2)
		  AND tp.deleted_at IS NULL AND mp.deleted_at IS NULL AND tt.deleted_at IS NULL
		ORDER BY tp.shirt_number ASC NULLS LAST, tp.created_at ASC
	`
	rows, err := r.db.Query(ctx, query, tournamentID, categoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*model.TournamentPlayer
	for rows.Next() {
		var tp model.TournamentPlayer
		var mp model.MasterPlayer
		if err := rows.Scan(
			&tp.ID, &tp.TournamentTeamID, &tp.MasterPlayerID, &tp.ShirtNumber, &tp.Position, &tp.CreatedAt, &tp.UpdatedAt,
			&mp.ID, &mp.UserID, &mp.Name,
			&mp.FirstNameLocal, &mp.MiddleNameLocal, &mp.LastNameLocal,
			&mp.FirstNameIntl, &mp.MiddleNameIntl, &mp.LastNameIntl,
			&mp.Nickname, &mp.Birthday, &mp.PhotoURL, &mp.Tel, &mp.FavoriteSportID,
			&mp.PreferredHand, &mp.PreferredFoot, &mp.CreatedAt, &mp.UpdatedAt,
		); err != nil {
			return nil, err
		}
		tp.MasterPlayer = &mp
		list = append(list, &tp)
	}
	return list, nil
}

func (r *RegistrationRepository) AddTournamentPlayer(ctx context.Context, tp *model.TournamentPlayer) error {
	// 1. Check if tournament player already exists for this team (active)
	var existingID uuid.UUID
	checkQuery := `
		SELECT id, created_at, updated_at
		FROM tournament_players
		WHERE tournament_team_id = $1 AND master_player_id = $2 AND deleted_at IS NULL
		LIMIT 1
	`
	err := r.db.QueryRow(ctx, checkQuery, tp.TournamentTeamID, tp.MasterPlayerID).Scan(&existingID, &tp.CreatedAt, &tp.UpdatedAt)
	if err == nil {
		tp.ID = existingID
		return r.UpdateTournamentPlayer(ctx, existingID, tp.ShirtNumber, tp.Position)
	}

	// 2. Check if a soft-deleted record exists, if so restore it
	var deletedID uuid.UUID
	checkDeletedQuery := `
		SELECT id
		FROM tournament_players
		WHERE tournament_team_id = $1 AND master_player_id = $2 AND deleted_at IS NOT NULL
		LIMIT 1
	`
	errDeleted := r.db.QueryRow(ctx, checkDeletedQuery, tp.TournamentTeamID, tp.MasterPlayerID).Scan(&deletedID)
	if errDeleted == nil {
		tp.ID = deletedID
		restoreQuery := `
			UPDATE tournament_players
			SET deleted_at = NULL,
			    shirt_number = COALESCE($1, shirt_number),
			    position = COALESCE($2, position),
			    updated_at = NOW()
			WHERE id = $3
			RETURNING created_at, updated_at
		`
		return r.db.QueryRow(ctx, restoreQuery, tp.ShirtNumber, tp.Position, deletedID).Scan(&tp.CreatedAt, &tp.UpdatedAt)
	}

	query := `
		INSERT INTO tournament_players (tournament_team_id, master_player_id, shirt_number, position)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (tournament_team_id, master_player_id) WHERE deleted_at IS NULL
		DO UPDATE SET
			shirt_number = COALESCE(EXCLUDED.shirt_number, tournament_players.shirt_number),
			position = COALESCE(EXCLUDED.position, tournament_players.position),
			updated_at = NOW()
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		tp.TournamentTeamID, tp.MasterPlayerID, tp.ShirtNumber, tp.Position,
	).Scan(&tp.ID, &tp.CreatedAt, &tp.UpdatedAt)
}

func (r *RegistrationRepository) GetTournamentPlayerMasterID(ctx context.Context, id uuid.UUID) (*uuid.UUID, error) {
	var masterID uuid.UUID
	err := r.db.QueryRow(ctx, "SELECT master_player_id FROM tournament_players WHERE id = $1", id).Scan(&masterID)
	if err != nil {
		return nil, err
	}
	return &masterID, nil
}

func (r *RegistrationRepository) UpdateTournamentPlayer(ctx context.Context, id uuid.UUID, shirtNumber, position *string) error {
	query := `
		UPDATE tournament_players
		SET shirt_number = COALESCE($1, shirt_number),
		    position = COALESCE($2, position),
		    updated_at = NOW()
		WHERE id = $3
	`
	_, err := r.db.Exec(ctx, query, shirtNumber, position, id)
	return err
}

func (r *RegistrationRepository) DeleteTournamentPlayer(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM tournament_players WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *RegistrationRepository) ListMyRegistrations(ctx context.Context, userID uuid.UUID) ([]*model.MyRegistrationItem, error) {
	query := `
		SELECT tt.id, tt.tournament_id, COALESCE(tt.tournament_category_id, tt.category_id) as category_id,
		       tt.team_id, tt.registration_status, tt.payment_status, tt.roster_status,
		       tt.is_roster_locked, tt.unlock_requested, tt.created_at,
		       t.name as team_name, COALESCE(t.logo_img, t.logo_url) as team_logo,
		       tour.name as tournament_name, tour.logo_url as tournament_logo,
		       COALESCE(ac.category_name, '') as category_name,
		       COALESCE(tc.gender_type, '') as gender_type
		FROM tournament_teams tt
		JOIN teams t ON tt.team_id = t.id
		JOIN tournaments tour ON tt.tournament_id = tour.id
		LEFT JOIN tournament_categories tc ON (tt.tournament_category_id = tc.id OR tt.category_id = tc.id)
		LEFT JOIN age_categories ac ON tc.age_category_id = ac.id
		WHERE (
		    t.user_id = $1 
		    OR t.created_by = $1
		)
		AND tt.deleted_at IS NULL
		ORDER BY tt.created_at DESC
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query my registrations: %w", err)
	}
	defer rows.Close()

	var list []*model.MyRegistrationItem
	for rows.Next() {
		var item model.MyRegistrationItem
		var catName, genderType string
		if err := rows.Scan(
			&item.ID, &item.TournamentID, &item.CategoryID,
			&item.TeamID, &item.RegistrationStatus, &item.PaymentStatus, &item.RosterStatus,
			&item.IsRosterLocked, &item.UnlockRequested, &item.CreatedAt,
			&item.TeamName, &item.TeamLogo,
			&item.TournamentName, &item.TournamentLogo,
			&catName, &genderType,
		); err != nil {
			return nil, err
		}

		if catName != "" {
			formattedGender := ""
			if genderType != "" {
				formattedGender = fmt.Sprintf(" - %c%s", genderType[0]-32, genderType[1:])
			}
			item.CategoryName = fmt.Sprintf("%s%s", catName, formattedGender)
			item.TournamentName = fmt.Sprintf("%s %s", item.TournamentName, item.CategoryName)
		}

		list = append(list, &item)
	}
	return list, nil
}

func (r *RegistrationRepository) ListIncomingTournamentActions(ctx context.Context, userID uuid.UUID) ([]*model.IncomingTournamentActionItem, error) {
	query := `
		SELECT tt.id, tt.tournament_id, COALESCE(tt.tournament_category_id, tt.category_id) as category_id,
		       tt.team_id, tt.registration_status, tt.payment_status, tt.roster_status,
		       tt.unlock_requested, tt.slip_img, tt.contact_name, tt.contact_phone,
		       tt.created_at,
		       t.name as team_name, COALESCE(t.logo_img, t.logo_url) as team_logo,
		       tour.name as tournament_name, tour.logo_url as tournament_logo,
		       tc.gender_type, tc.max_teams, COALESCE((tc.rules_config->>'min_players')::int, 5) as min_players, COALESCE((tc.rules_config->>'max_players')::int, 20) as max_players, tc.registration_fee,
		       ac.category_name,
		       COALESCE((SELECT COUNT(*) FROM tournament_roster_submissions trs WHERE trs.tournament_team_id = tt.id AND trs.status = 'pending'), 0) as roster_count,
		       COALESCE((SELECT COUNT(*) FROM tournament_teams tt_app WHERE (tt_app.tournament_category_id = tc.id OR tt_app.category_id = tc.id) AND tt_app.registration_status = 'approved' AND tt_app.deleted_at IS NULL), 0) as approved_teams_count
		FROM tournament_teams tt
		JOIN teams t ON tt.team_id = t.id
		JOIN tournaments tour ON tt.tournament_id = tour.id
		LEFT JOIN tournament_categories tc ON (tt.tournament_category_id = tc.id OR tt.category_id = tc.id)
		LEFT JOIN age_categories ac ON tc.age_category_id = ac.id
		LEFT JOIN tournament_invitations ti ON tour.id = ti.tournament_id AND ti.user_id = $1 AND ti.status = 'accepted' AND ti.deleted_at IS NULL
		WHERE (tour.organizer_id = $1 OR ti.id IS NOT NULL)
		  AND tt.deleted_at IS NULL
		ORDER BY tt.created_at DESC
		LIMIT 100
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query incoming tournament actions: %w", err)
	}
	defer rows.Close()

	var list []*model.IncomingTournamentActionItem
	for rows.Next() {
		var item model.IncomingTournamentActionItem
		var regStatus, rosterStatus string
		var unlockReq bool
		var genderType, catName *string

		if err := rows.Scan(
			&item.ID, &item.TournamentID, &item.CategoryID,
			&item.TeamID, &regStatus, &item.PaymentStatus, &rosterStatus,
			&unlockReq, &item.SlipImg, &item.ContactName, &item.ContactPhone,
			&item.CreatedAt,
			&item.TeamName, &item.TeamLogo,
			&item.TournamentName, &item.TournamentLogo,
			&genderType, &item.MaxTeams, &item.MinPlayers, &item.MaxPlayers, &item.RegistrationFee,
			&catName,
			&item.RosterPlayerCount,
			&item.ApprovedTeamsCount,
		); err != nil {
			return nil, err
		}

		if catName != nil && *catName != "" {
			formattedCat := *catName
			if genderType != nil && *genderType != "" {
				formattedCat = fmt.Sprintf("%s - %s", *catName, *genderType)
			}
			item.CategoryName = &formattedCat
		}

		if regStatus == "pending" {
			item.ActionType = "tournament_registration"
			item.Status = regStatus
		} else if unlockReq {
			item.ActionType = "tournament_roster_unlock"
			item.Status = "pending"
		} else if rosterStatus == "pending" && item.RosterPlayerCount > 0 {
			item.ActionType = "tournament_roster_submission"
			item.Status = rosterStatus
		} else if regStatus == "approved" {
			item.ActionType = "tournament_registration"
			item.Status = "approved"
		} else if regStatus == "rejected" {
			item.ActionType = "tournament_registration"
			item.Status = "rejected"
		} else {
			item.ActionType = "tournament_registration"
			item.Status = regStatus
		}

		list = append(list, &item)
	}
	return list, nil
}

func (r *RegistrationRepository) ApproveRoster(ctx context.Context, tournamentTeamID uuid.UUID) error {
	query := `
		SELECT id, tournament_team_id, master_player_id, player_id, name, shirt_number, position, tel, photo_url
		FROM tournament_roster_submissions
		WHERE tournament_team_id = $1 AND status = 'pending' AND deleted_at IS NULL
	`
	rows, err := r.db.Query(ctx, query, tournamentTeamID)
	if err != nil {
		return err
	}
	defer rows.Close()

	type subItem struct {
		id, tournamentTeamID uuid.UUID
		masterPlayerID, playerID *uuid.UUID
		name string
		shirtNumber, position, tel, photoURL *string
	}
	var submissions []subItem

	for rows.Next() {
		var s subItem
		if err := rows.Scan(&s.id, &s.tournamentTeamID, &s.masterPlayerID, &s.playerID, &s.name, &s.shirtNumber, &s.position, &s.tel, &s.photoURL); err != nil {
			return err
		}
		submissions = append(submissions, s)
	}
	rows.Close()

	for _, s := range submissions {
		var masterID uuid.UUID
		if s.masterPlayerID != nil && *s.masterPlayerID != uuid.Nil {
			masterID = *s.masterPlayerID
		} else {
			if s.tel != nil && *s.tel != "" {
				_ = r.db.QueryRow(ctx, `SELECT id FROM master_players WHERE tel = $1 AND deleted_at IS NULL LIMIT 1`, *s.tel).Scan(&masterID)
			}
			if masterID == uuid.Nil && s.name != "" {
				namePattern := "%" + strings.TrimSpace(s.name) + "%"
				_ = r.db.QueryRow(ctx, `
					SELECT id FROM master_players 
					WHERE (first_name_local ILIKE $1 OR last_name_local ILIKE $1 OR first_name_intl ILIKE $1 OR last_name_intl ILIKE $1)
					  AND deleted_at IS NULL 
					LIMIT 1
				`, namePattern).Scan(&masterID)
			}
			if masterID == uuid.Nil {
				parts := strings.Fields(s.name)
				first := "Player"
				last := "-"
				if len(parts) > 0 {
					first = parts[0]
				}
				if len(parts) > 1 {
					last = strings.Join(parts[1:], " ")
				}
				var fLocal, lLocal, fIntl, lIntl *string
				if isASCII(first) && isASCII(last) {
					fIntl = &first
					lIntl = &last
				} else {
					fLocal = &first
					lLocal = &last
				}
				createQ := `
					INSERT INTO master_players (first_name_local, last_name_local, first_name_intl, last_name_intl, tel, photo_url, status, verified)
					VALUES ($1, $2, $3, $4, $5, $6, 'active', false)
					RETURNING id
				`
				_ = r.db.QueryRow(ctx, createQ, fLocal, lLocal, fIntl, lIntl, s.tel, s.photoURL).Scan(&masterID)
			}
		}

		if masterID != uuid.Nil {
			tpQuery := `
				INSERT INTO tournament_players (tournament_team_id, master_player_id, shirt_number, position, created_at, updated_at)
				VALUES ($1, $2, $3, $4, NOW(), NOW())
				ON CONFLICT (tournament_team_id, master_player_id) WHERE deleted_at IS NULL
				DO UPDATE SET
					shirt_number = COALESCE(EXCLUDED.shirt_number, tournament_players.shirt_number),
					position = COALESCE(EXCLUDED.position, tournament_players.position),
					updated_at = NOW()
			`
			_, _ = r.db.Exec(ctx, tpQuery, tournamentTeamID, masterID, s.shirtNumber, s.position)
		}

		upSub := `
			UPDATE tournament_roster_submissions
			SET status = 'approved',
			    master_player_id = COALESCE($2, master_player_id),
			    rejection_reason = NULL,
			    updated_at = NOW()
			WHERE id = $1
		`
		var mIDPtr *uuid.UUID
		if masterID != uuid.Nil {
			mIDPtr = &masterID
		}
		_, _ = r.db.Exec(ctx, upSub, s.id, mIDPtr)
	}

	upTeam := `
		UPDATE tournament_teams
		SET roster_status = 'approved',
		    is_roster_locked = TRUE,
		    updated_at = NOW()
		WHERE id = $1
	`
	_, err = r.db.Exec(ctx, upTeam, tournamentTeamID)
	return err
}

func (r *RegistrationRepository) RejectRoster(ctx context.Context, tournamentTeamID uuid.UUID) error {
	upSub := `
		UPDATE tournament_roster_submissions
		SET status = 'rejected',
		    updated_at = NOW()
		WHERE tournament_team_id = $1 AND status = 'pending'
	`
	_, _ = r.db.Exec(ctx, upSub, tournamentTeamID)

	upTeam := `
		UPDATE tournament_teams
		SET roster_status = 'rejected',
		    is_roster_locked = FALSE,
		    updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, upTeam, tournamentTeamID)
	return err
}

func (r *RegistrationRepository) ApproveSingleRosterSubmission(ctx context.Context, submissionID uuid.UUID) error {
	var s struct {
		id, tournamentTeamID uuid.UUID
		masterPlayerID, playerID *uuid.UUID
		name string
		shirtNumber, position, tel, photoURL *string
	}
	query := `
		SELECT id, tournament_team_id, master_player_id, player_id, name, shirt_number, position, tel, photo_url
		FROM tournament_roster_submissions
		WHERE id = $1 AND deleted_at IS NULL
	`
	err := r.db.QueryRow(ctx, query, submissionID).Scan(
		&s.id, &s.tournamentTeamID, &s.masterPlayerID, &s.playerID, &s.name, &s.shirtNumber, &s.position, &s.tel, &s.photoURL,
	)
	if err != nil {
		return err
	}

	var masterID uuid.UUID
	if s.masterPlayerID != nil && *s.masterPlayerID != uuid.Nil {
		masterID = *s.masterPlayerID
	} else {
		if s.tel != nil && *s.tel != "" {
			_ = r.db.QueryRow(ctx, `SELECT id FROM master_players WHERE tel = $1 AND deleted_at IS NULL LIMIT 1`, *s.tel).Scan(&masterID)
		}
		if masterID == uuid.Nil && s.name != "" {
			namePattern := "%" + strings.TrimSpace(s.name) + "%"
			_ = r.db.QueryRow(ctx, `
				SELECT id FROM master_players 
				WHERE (first_name_local ILIKE $1 OR last_name_local ILIKE $1 OR first_name_intl ILIKE $1 OR last_name_intl ILIKE $1)
				  AND deleted_at IS NULL 
				LIMIT 1
			`, namePattern).Scan(&masterID)
		}
		if masterID == uuid.Nil {
			parts := strings.Fields(s.name)
			first := "Player"
			last := "-"
			if len(parts) > 0 {
				first = parts[0]
			}
			if len(parts) > 1 {
				last = strings.Join(parts[1:], " ")
			}
			var fLocal, lLocal, fIntl, lIntl *string
			if isASCII(first) && isASCII(last) {
				fIntl = &first
				lIntl = &last
			} else {
				fLocal = &first
				lLocal = &last
			}
			createQ := `
				INSERT INTO master_players (first_name_local, last_name_local, first_name_intl, last_name_intl, tel, photo_url, status, verified)
				VALUES ($1, $2, $3, $4, $5, $6, 'active', false)
				RETURNING id
			`
			_ = r.db.QueryRow(ctx, createQ, fLocal, lLocal, fIntl, lIntl, s.tel, s.photoURL).Scan(&masterID)
		}
	}

	if masterID != uuid.Nil {
		tpQuery := `
			INSERT INTO tournament_players (tournament_team_id, master_player_id, shirt_number, position, created_at, updated_at)
			VALUES ($1, $2, $3, $4, NOW(), NOW())
			ON CONFLICT (tournament_team_id, master_player_id) WHERE deleted_at IS NULL
			DO UPDATE SET
				shirt_number = COALESCE(EXCLUDED.shirt_number, tournament_players.shirt_number),
				position = COALESCE(EXCLUDED.position, tournament_players.position),
				updated_at = NOW()
		`
		_, _ = r.db.Exec(ctx, tpQuery, s.tournamentTeamID, masterID, s.shirtNumber, s.position)
	}

	var mIDPtr *uuid.UUID
	if masterID != uuid.Nil {
		mIDPtr = &masterID
	}
	upSub := `
		UPDATE tournament_roster_submissions
		SET status = 'approved',
		    master_player_id = COALESCE($2, master_player_id),
		    rejection_reason = NULL,
		    updated_at = NOW()
		WHERE id = $1
	`
	_, err = r.db.Exec(ctx, upSub, submissionID, mIDPtr)
	if err != nil {
		return err
	}

	var pendingCount int
	_ = r.db.QueryRow(ctx, `SELECT COUNT(*) FROM tournament_roster_submissions WHERE tournament_team_id = $1 AND status = 'pending' AND deleted_at IS NULL`, s.tournamentTeamID).Scan(&pendingCount)
	if pendingCount == 0 {
		_, _ = r.db.Exec(ctx, `UPDATE tournament_teams SET roster_status = 'approved', is_roster_locked = TRUE, updated_at = NOW() WHERE id = $1`, s.tournamentTeamID)
	}

	return nil
}

func (r *RegistrationRepository) RejectSingleRosterSubmission(ctx context.Context, submissionID uuid.UUID, reason string) error {
	upSub := `
		UPDATE tournament_roster_submissions
		SET status = 'rejected',
		    rejection_reason = NULLIF($2, ''),
		    updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, upSub, submissionID, reason)
	return err
}

func (r *RegistrationRepository) BatchApproveRosterSubmissions(ctx context.Context, tournamentTeamID uuid.UUID, submissionIDs []uuid.UUID) error {
	for _, id := range submissionIDs {
		_ = r.ApproveSingleRosterSubmission(ctx, id)
	}
	return nil
}

func isASCII(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] > unicode.MaxASCII {
			return false
		}
	}
	return true
}

