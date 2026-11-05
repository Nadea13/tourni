package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"tourni-backend/internal/model"
)

type MatchRepository struct {
	db *pgxpool.Pool
}

func NewMatchRepository(db *pgxpool.Pool) *MatchRepository {
	return &MatchRepository{db: db}
}

const matchSelectFields = `
	m.id, m.category_id, m.home_team_id, m.away_team_id, m.home_score, m.away_score, 
	m.round, m.stage, m.status, m.is_manual, m.scheduled_at, m.idx_match,
	m.timer_status, m.elapsed_seconds, m.minute, m.node_id, m.next_node_id,
	m.ph_home, m.ph_away, m.score_detail, m.created_at, m.updated_at, m.deleted_at,
	ht.id, ht.name, ht.short_name, ht.logo_url,
	at.id, at.name, at.short_name, at.logo_url
`

func sanitizeMatchStatus(s model.MatchStatus) string {
	switch s {
	case model.MatchLive, model.MatchFirstHalf, model.MatchSecondHalf, model.MatchHalfTime, model.MatchWarmup, model.MatchExtraTime, model.MatchPenalties, "in_progress":
		return "live"
	case model.MatchFinished, model.MatchCompleted:
		return "finished"
	case model.MatchCancelled, model.MatchCanceled, model.MatchPostponed:
		return "cancelled"
	default:
		return "scheduled"
	}
}

func sanitizeMatchStage(s string) string {
	switch s {
	case "knockout", "round_of_16", "quarter_final", "semi_final":
		return "knockout"
	case "final", "third_place":
		return "final"
	default:
		return "group"
	}
}

func sanitizeTimerStatus(s string) string {
	switch s {
	case "playing", "running":
		return "playing"
	case "paused":
		return "paused"
	default:
		return "stopped"
	}
}

func parseScore(scoreBytes []byte) int {
	if len(scoreBytes) == 0 {
		return 0
	}
	var intVal int
	if err := json.Unmarshal(scoreBytes, &intVal); err == nil {
		return intVal
	}
	var mapVal map[string]interface{}
	if err := json.Unmarshal(scoreBytes, &mapVal); err == nil {
		if total, ok := mapVal["total"].(float64); ok {
			return int(total)
		}
		if total, ok := mapVal["total"].(int); ok {
			return total
		}
	}
	return 0
}

func scanMatchRow(scanner interface {
	Scan(dest ...any) error
}, m *model.Match) error {
	var htID, atID *uuid.UUID
	var htName, atName *string
	var htShort, atShort *string
	var htLogo, atLogo *string
	var rawStatus, rawStage, rawTimerStatus string
	var scoreDetailBytes []byte

	err := scanner.Scan(
		&m.ID, &m.CategoryID, &m.HomeTeamID, &m.AwayTeamID, &m.HomeScore, &m.AwayScore,
		&m.Round, &rawStage, &rawStatus, &m.IsManual, &m.ScheduledAt, &m.IdxMatch,
		&rawTimerStatus, &m.ElapsedSeconds, &m.Minute, &m.NodeID, &m.NextNodeID,
		&m.PhHome, &m.PhAway, &scoreDetailBytes, &m.CreatedAt, &m.UpdatedAt, &m.DeletedAt,
		&htID, &htName, &htShort, &htLogo,
		&atID, &atName, &atShort, &atLogo,
	)
	if err != nil {
		return err
	}

	m.Status = model.MatchStatus(rawStatus)
	m.Stage = rawStage
	m.TimerStatus = rawTimerStatus
	// Sync compatibility aliases
	m.TournamentCategoryID = m.CategoryID
	m.MatchIndex = m.IdxMatch
	m.WinnerToNodeID = m.NextNodeID
	m.PlaceholderHome = m.PhHome
	m.PlaceholderAway = m.PhAway
	m.PlaceholderA = m.PhHome
	m.PlaceholderB = m.PhAway
	m.ElapsedBeforePause = m.ElapsedSeconds
	m.CurrentMinute = m.Minute

	if len(scoreDetailBytes) > 0 {
		_ = json.Unmarshal(scoreDetailBytes, &m.ScoreDetail)
		if m.ScoreDetail != nil {
			if v, ok := m.ScoreDetail["penalty_home_score"].(float64); ok {
				val := int(v)
				m.PenaltyHomeScore = &val
				m.HomePenaltyScore = &val
			} else if v, ok := m.ScoreDetail["home_penalty_score"].(float64); ok {
				val := int(v)
				m.PenaltyHomeScore = &val
				m.HomePenaltyScore = &val
			}
			if v, ok := m.ScoreDetail["penalty_away_score"].(float64); ok {
				val := int(v)
				m.PenaltyAwayScore = &val
				m.AwayPenaltyScore = &val
			} else if v, ok := m.ScoreDetail["away_penalty_score"].(float64); ok {
				val := int(v)
				m.PenaltyAwayScore = &val
				m.AwayPenaltyScore = &val
			}
			if v, ok := m.ScoreDetail["winner_id"].(string); ok && v != "" {
				if parsed, err := uuid.Parse(v); err == nil {
					m.WinnerID = &parsed
					m.WinnerToNodeID = &v
				}
			}
		}
	}

	if htID != nil {
		m.HomeTeam = &model.Team{
			ID:        *htID,
			Name:      *htName,
			ShortName: htShort,
			LogoURL:   htLogo,
		}
	}
	if atID != nil {
		m.AwayTeam = &model.Team{
			ID:        *atID,
			Name:      *atName,
			ShortName: atShort,
			LogoURL:   atLogo,
		}
	}

	return nil
}

func (r *MatchRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Match, error) {
	query := `
		SELECT ` + matchSelectFields + `
		FROM matches m
		LEFT JOIN teams ht ON m.home_team_id = ht.id
		LEFT JOIN teams at ON m.away_team_id = at.id
		WHERE m.id = $1 AND m.deleted_at IS NULL
	`
	var m model.Match
	err := scanMatchRow(r.db.QueryRow(ctx, query, id), &m)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get match: %w", err)
	}

	return &m, nil
}

func (r *MatchRepository) Create(ctx context.Context, m *model.Match) error {
	if m.Round <= 0 {
		m.Round = 1
	}
	if m.CategoryID == nil && m.TournamentCategoryID != nil {
		m.CategoryID = m.TournamentCategoryID
	}
	if m.IdxMatch == 0 && m.MatchIndex > 0 {
		m.IdxMatch = m.MatchIndex
	}
	if m.NextNodeID == nil && m.WinnerToNodeID != nil {
		m.NextNodeID = m.WinnerToNodeID
	}
	if m.PhHome == nil {
		if m.PlaceholderHome != nil {
			m.PhHome = m.PlaceholderHome
		} else if m.PlaceholderA != nil {
			m.PhHome = m.PlaceholderA
		}
	}
	if m.PhAway == nil {
		if m.PlaceholderAway != nil {
			m.PhAway = m.PlaceholderAway
		} else if m.PlaceholderB != nil {
			m.PhAway = m.PlaceholderB
		}
	}
	if m.ElapsedSeconds == 0 && m.ElapsedBeforePause > 0 {
		m.ElapsedSeconds = m.ElapsedBeforePause
	} else if m.ElapsedSeconds > 0 && m.ElapsedBeforePause == 0 {
		m.ElapsedBeforePause = m.ElapsedSeconds
	}
	if m.Minute == nil && m.CurrentMinute != nil {
		m.Minute = m.CurrentMinute
	}

	if m.Status == model.MatchFinished || m.Status == "completed" || m.Status == "finished" {
		m.TimerStatus = "stopped"
	}

	dbStatus := sanitizeMatchStatus(m.Status)
	dbStage := sanitizeMatchStage(m.Stage)
	dbTimerStatus := sanitizeTimerStatus(m.TimerStatus)

	var scoreDetailJSON []byte
	if m.ScoreDetail != nil {
		scoreDetailJSON, _ = json.Marshal(m.ScoreDetail)
	} else {
		scoreDetailJSON = []byte("{}")
	}

	query := `
		INSERT INTO matches (category_id, home_team_id, away_team_id, home_score, away_score,
		                     round, stage, status, is_manual, scheduled_at, idx_match,
		                     timer_status, elapsed_seconds, minute, node_id, next_node_id,
		                     ph_home, ph_away, score_detail)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		m.CategoryID, m.HomeTeamID, m.AwayTeamID, m.HomeScore, m.AwayScore,
		m.Round, dbStage, dbStatus, m.IsManual, m.ScheduledAt, m.IdxMatch,
		dbTimerStatus, m.ElapsedSeconds, m.Minute, m.NodeID, m.NextNodeID,
		m.PhHome, m.PhAway, scoreDetailJSON,
	).Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt)
}

func (r *MatchRepository) Update(ctx context.Context, m *model.Match) error {
	existing, err := r.GetByID(ctx, m.ID)
	if err != nil {
		return fmt.Errorf("failed to fetch existing match: %w", err)
	}

	if m.CategoryID == nil && m.TournamentCategoryID != nil {
		m.CategoryID = m.TournamentCategoryID
	}
	if m.IdxMatch == 0 && m.MatchIndex > 0 {
		m.IdxMatch = m.MatchIndex
	}
	if m.NextNodeID == nil && m.WinnerToNodeID != nil {
		m.NextNodeID = m.WinnerToNodeID
	}
	if m.PhHome == nil {
		if m.PlaceholderHome != nil {
			m.PhHome = m.PlaceholderHome
		} else if m.PlaceholderA != nil {
			m.PhHome = m.PlaceholderA
		}
	}
	if m.PhAway == nil {
		if m.PlaceholderAway != nil {
			m.PhAway = m.PlaceholderAway
		} else if m.PlaceholderB != nil {
			m.PhAway = m.PlaceholderB
		}
	}
	if m.ElapsedSeconds == 0 && m.ElapsedBeforePause > 0 {
		m.ElapsedSeconds = m.ElapsedBeforePause
	} else if m.ElapsedSeconds > 0 && m.ElapsedBeforePause == 0 {
		m.ElapsedBeforePause = m.ElapsedSeconds
	}
	if m.Minute == nil && m.CurrentMinute != nil {
		m.Minute = m.CurrentMinute
	}

	if existing != nil {
		if m.CategoryID == nil {
			m.CategoryID = existing.CategoryID
		}
		isEndedOrLive := existing.Status == "finished" || existing.Status == "completed" || existing.Status == "live" || existing.Status == "first_half" || existing.Status == "second_half" || existing.Status == "half_time" || existing.Status == "extra_time" || existing.Status == "penalties"
		hasResult := isEndedOrLive || existing.HomeScore > 0 || existing.AwayScore > 0
		if hasResult {
			if existing.HomeTeamID != nil {
				m.HomeTeamID = existing.HomeTeamID
			}
			if existing.AwayTeamID != nil {
				m.AwayTeamID = existing.AwayTeamID
			}
		}

		// Prevent same team for both home and away in the same match
		if m.HomeTeamID != nil && m.AwayTeamID != nil && *m.HomeTeamID == *m.AwayTeamID {
			m.AwayTeamID = nil
			m.PlaceholderB = nil
			m.PhAway = nil
		}
		if m.Status == "" {
			m.Status = existing.Status
		}
		if m.ScheduledAt == nil {
			m.ScheduledAt = existing.ScheduledAt
		}
		if m.Round == 0 {
			m.Round = existing.Round
		}
		if m.IdxMatch == 0 {
			m.IdxMatch = existing.IdxMatch
		}
		if m.Stage == "" {
			m.Stage = existing.Stage
		}
		if m.NodeID == nil {
			m.NodeID = existing.NodeID
		}
		if m.NextNodeID == nil {
			m.NextNodeID = existing.NextNodeID
		}
		if m.PhHome == nil {
			m.PhHome = existing.PhHome
		}
		if m.PhAway == nil {
			m.PhAway = existing.PhAway
		}
		if m.TimerStatus == "" {
			m.TimerStatus = existing.TimerStatus
		}
		if m.Minute == nil {
			m.Minute = existing.Minute
		}
		if m.ScoreDetail == nil {
			m.ScoreDetail = existing.ScoreDetail
		}
	}

	if m.Round <= 0 {
		m.Round = 1
	}

	if m.Status == model.MatchFinished || m.Status == "completed" || m.Status == "finished" {
		m.TimerStatus = "stopped"
	}

	dbStatus := sanitizeMatchStatus(m.Status)
	dbStage := sanitizeMatchStage(m.Stage)
	dbTimerStatus := sanitizeTimerStatus(m.TimerStatus)

	var scoreDetailJSON []byte
	if m.ScoreDetail != nil {
		scoreDetailJSON, _ = json.Marshal(m.ScoreDetail)
	} else {
		scoreDetailJSON = []byte("{}")
	}

	query := `
		UPDATE matches
		SET home_team_id = $1, away_team_id = $2, home_score = $3, away_score = $4,
		    status = $5, scheduled_at = $6, round = $7, stage = $8,
		    is_manual = $9, idx_match = $10, timer_status = $11,
		    elapsed_seconds = $12, minute = $13,
		    node_id = $14, next_node_id = $15, ph_home = $16, ph_away = $17,
		    score_detail = $18, updated_at = NOW()
		WHERE id = $19 AND deleted_at IS NULL
	`
	_, execErr := r.db.Exec(ctx, query,
		m.HomeTeamID, m.AwayTeamID, m.HomeScore, m.AwayScore,
		dbStatus, m.ScheduledAt, m.Round, dbStage,
		m.IsManual, m.IdxMatch, dbTimerStatus,
		m.ElapsedSeconds, m.Minute,
		m.NodeID, m.NextNodeID, m.PhHome, m.PhAway,
		scoreDetailJSON, m.ID,
	)
	return execErr
}

func (r *MatchRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE matches SET deleted_at = NOW() WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *MatchRepository) UpdateScore(ctx context.Context, id uuid.UUID, homeScore, awayScore int, status model.MatchStatus) error {
	dbStatus := sanitizeMatchStatus(status)

	query := `
		UPDATE matches
		SET home_score = $1, away_score = $2, status = $3, updated_at = NOW()
		WHERE id = $4 AND deleted_at IS NULL
	`
	_, err := r.db.Exec(ctx, query, homeScore, awayScore, dbStatus, id)
	return err
}

func (r *MatchRepository) GetMatchesByCategory(ctx context.Context, categoryID uuid.UUID) ([]*model.Match, error) {
	query := `
		SELECT ` + matchSelectFields + `
		FROM matches m
		LEFT JOIN teams ht ON m.home_team_id = ht.id
		LEFT JOIN teams at ON m.away_team_id = at.id
		WHERE m.category_id = $1 AND m.deleted_at IS NULL
		ORDER BY m.round ASC, m.idx_match ASC, m.created_at ASC
	`
	rows, err := r.db.Query(ctx, query, categoryID)
	if err != nil {
		return nil, fmt.Errorf("failed to query matches: %w", err)
	}
	defer rows.Close()

	var matches []*model.Match
	for rows.Next() {
		var m model.Match
		if err := scanMatchRow(rows, &m); err != nil {
			return nil, err
		}
		matches = append(matches, &m)
	}

	return matches, nil
}

func (r *MatchRepository) GetMatchesByTournament(ctx context.Context, tournamentID uuid.UUID) ([]*model.Match, error) {
	query := `
		SELECT ` + matchSelectFields + `
		FROM matches m
		JOIN tournament_categories tc ON m.category_id = tc.id
		LEFT JOIN teams ht ON m.home_team_id = ht.id
		LEFT JOIN teams at ON m.away_team_id = at.id
		WHERE tc.tournament_id = $1 AND m.deleted_at IS NULL
		ORDER BY m.scheduled_at ASC NULLS LAST, m.round ASC, m.idx_match ASC, m.created_at ASC
	`
	rows, err := r.db.Query(ctx, query, tournamentID)
	if err != nil {
		return nil, fmt.Errorf("failed to query tournament matches: %w", err)
	}
	defer rows.Close()

	var matches []*model.Match
	for rows.Next() {
		var m model.Match
		if err := scanMatchRow(rows, &m); err != nil {
			return nil, err
		}
		matches = append(matches, &m)
	}

	return matches, nil
}

// SyncCategoryMatches updates/creates matches in a category and deletes orphaned ones
func (r *MatchRepository) SyncCategoryMatches(ctx context.Context, categoryID uuid.UUID, matches []*model.Match, validIDs []uuid.UUID) ([]*model.Match, error) {
	var result []*model.Match
	activeIDsMap := make(map[uuid.UUID]bool)

	preserveExistingState := func(m *model.Match, existing *model.Match) {
		if existing == nil {
			return
		}
		if m.Status == "" || (m.Status == "scheduled" && existing.Status != "") {
			m.Status = existing.Status
		}
		if m.Status == "finished" || m.Status == "completed" {
			m.TimerStatus = "stopped"
		} else if m.TimerStatus == "" {
			m.TimerStatus = existing.TimerStatus
		}
		if m.HomeScore == 0 && existing.HomeScore > 0 {
			m.HomeScore = existing.HomeScore
		}
		if m.AwayScore == 0 && existing.AwayScore > 0 {
			m.AwayScore = existing.AwayScore
		}
		if m.ElapsedSeconds == 0 && existing.ElapsedSeconds > 0 {
			m.ElapsedSeconds = existing.ElapsedSeconds
		}
		if m.Minute == nil && existing.Minute != nil {
			m.Minute = existing.Minute
		}
		if m.ScoreDetail == nil && existing.ScoreDetail != nil {
			m.ScoreDetail = existing.ScoreDetail
		}
		if m.NextNodeID == nil && existing.NextNodeID != nil {
			m.NextNodeID = existing.NextNodeID
		}
		if m.WinnerToNodeID == nil && existing.WinnerToNodeID != nil {
			m.WinnerToNodeID = existing.WinnerToNodeID
		}

		isEndedOrLive := existing.Status == "finished" || existing.Status == "completed" || existing.Status == "live" || existing.Status == "first_half" || existing.Status == "second_half" || existing.Status == "half_time" || existing.Status == "extra_time" || existing.Status == "penalties"
		hasResult := isEndedOrLive || existing.HomeScore > 0 || existing.AwayScore > 0
		if hasResult {
			if existing.HomeTeamID != nil {
				m.HomeTeamID = existing.HomeTeamID
			}
			if existing.AwayTeamID != nil {
				m.AwayTeamID = existing.AwayTeamID
			}
		}

		// Prevent same team for both home and away in the same match
		if m.HomeTeamID != nil && m.AwayTeamID != nil && *m.HomeTeamID == *m.AwayTeamID {
			m.AwayTeamID = nil
			m.PlaceholderB = nil
			m.PhAway = nil
		}

		if m.ScheduledAt == nil && existing.ScheduledAt != nil {
			m.ScheduledAt = existing.ScheduledAt
		}
	}

	for _, m := range matches {
		m.CategoryID = &categoryID
		m.TournamentCategoryID = &categoryID
		if m.IdxMatch == 0 && m.MatchIndex > 0 {
			m.IdxMatch = m.MatchIndex
		}
		if m.ID != uuid.Nil {
			existing, err := r.GetByID(ctx, m.ID)
			if err == nil && existing != nil {
				preserveExistingState(m, existing)
				if err := r.Update(ctx, m); err != nil {
					return nil, err
				}
				result = append(result, m)
				activeIDsMap[m.ID] = true
				continue
			}
		}

		// Check if a match with same node_id and idx_match exists
		if m.NodeID != nil && *m.NodeID != "" {
			var existingID uuid.UUID
			err := r.db.QueryRow(ctx, `
				SELECT id FROM matches 
				WHERE category_id = $1 AND node_id = $2 AND idx_match = $3 AND deleted_at IS NULL
				LIMIT 1
			`, categoryID, *m.NodeID, m.IdxMatch).Scan(&existingID)
			if err == nil && existingID != uuid.Nil {
				m.ID = existingID
				if existing, err := r.GetByID(ctx, existingID); err == nil && existing != nil {
					preserveExistingState(m, existing)
				}
				if err := r.Update(ctx, m); err != nil {
					return nil, err
				}
				result = append(result, m)
				activeIDsMap[m.ID] = true
				continue
			}
		}

		// Prevent same team for both home and away in the same match
		if m.HomeTeamID != nil && m.AwayTeamID != nil && *m.HomeTeamID == *m.AwayTeamID {
			m.AwayTeamID = nil
			m.PlaceholderB = nil
			m.PhAway = nil
		}

		// Create new match
		if err := r.Create(ctx, m); err != nil {
			return nil, err
		}
		result = append(result, m)
		activeIDsMap[m.ID] = true
	}

	for _, vid := range validIDs {
		if vid != uuid.Nil {
			activeIDsMap[vid] = true
		}
	}

	var activeIDs []uuid.UUID
	for id := range activeIDsMap {
		activeIDs = append(activeIDs, id)
	}

	// Soft delete orphaned matches (any match not in the current canvas matches for this category)
	if len(activeIDs) > 0 {
		_, _ = r.db.Exec(ctx, `
			UPDATE matches 
			SET deleted_at = NOW() 
			WHERE category_id = $1 AND deleted_at IS NULL AND NOT (id = ANY($2))
		`, categoryID, activeIDs)
	} else {
		// All matches/match nodes removed -> soft delete all matches for category
		_, _ = r.db.Exec(ctx, `
			UPDATE matches 
			SET deleted_at = NOW() 
			WHERE category_id = $1 AND deleted_at IS NULL
		`, categoryID)
	}

	return result, nil
}

// ================= Match Events =================

func (r *MatchRepository) AddEvent(ctx context.Context, e *model.MatchEvent) error {
	eventType := e.Type
	if eventType == "" && e.EventType != "" {
		eventType = e.EventType
	}
	detailMap := e.Detail
	if detailMap == nil && e.ExtraInfo != nil {
		detailMap = e.ExtraInfo
	}
	if detailMap == nil {
		detailMap = make(map[string]interface{})
	}

	// Defensively resolve team_id if a tournament_team_id was passed or verify it exists
	if e.TeamID != nil && *e.TeamID != uuid.Nil {
		var resolvedTeamID *uuid.UUID
		err := r.db.QueryRow(ctx, `
			SELECT COALESCE(
				(SELECT id FROM teams WHERE id = $1),
				(SELECT team_id FROM tournament_teams WHERE id = $1)
			)
		`, *e.TeamID).Scan(&resolvedTeamID)
		if err == nil && resolvedTeamID != nil && *resolvedTeamID != uuid.Nil {
			e.TeamID = resolvedTeamID
		} else {
			e.TeamID = nil
		}
	}

	// Defensively verify player_id exists in players table, or resolve from tournament_players
	if e.PlayerID != nil && *e.PlayerID != uuid.Nil {
		origPlayerID := *e.PlayerID
		var resolvedPlayerID *uuid.UUID
		var resolvedName *string

		_ = r.db.QueryRow(ctx, `
			SELECT COALESCE(
				(SELECT id FROM players WHERE id = $1),
				(SELECT p.id FROM players p JOIN tournament_players tp ON p.master_player_id = tp.master_player_id WHERE tp.id = $1 LIMIT 1),
				(SELECT p.id FROM players p WHERE p.master_player_id = $1 LIMIT 1)
			),
			COALESCE(
				NULLIF(TRIM((SELECT first_name || ' ' || last_name FROM players WHERE id = $1)), ''),
				NULLIF(TRIM((SELECT CONCAT(mp.first_name_local, ' ', CASE WHEN mp.last_name_local = '-' THEN '' ELSE mp.last_name_local END) FROM tournament_players tp JOIN master_players mp ON tp.master_player_id = mp.id WHERE tp.id = $1)), ''),
				NULLIF(TRIM((SELECT CONCAT(mp.first_name_intl, ' ', CASE WHEN mp.last_name_intl = '-' THEN '' ELSE mp.last_name_intl END) FROM tournament_players tp JOIN master_players mp ON tp.master_player_id = mp.id WHERE tp.id = $1)), ''),
				NULLIF(TRIM((SELECT CONCAT(mp.first_name_local, ' ', CASE WHEN mp.last_name_local = '-' THEN '' ELSE mp.last_name_local END) FROM master_players mp WHERE mp.id = $1)), ''),
				NULLIF(TRIM((SELECT CONCAT(mp.first_name_intl, ' ', CASE WHEN mp.last_name_intl = '-' THEN '' ELSE mp.last_name_intl END) FROM master_players mp WHERE mp.id = $1)), '')
			)
		`, origPlayerID).Scan(&resolvedPlayerID, &resolvedName)

		if resolvedPlayerID != nil && *resolvedPlayerID != uuid.Nil {
			e.PlayerID = resolvedPlayerID
		} else {
			e.PlayerID = nil
		}

		if detailMap["player_id"] == nil || detailMap["player_id"] == "" {
			detailMap["player_id"] = origPlayerID.String()
		}
		if (detailMap["player_name"] == nil || detailMap["player_name"] == "" || detailMap["player_name"] == "Unknown") && resolvedName != nil && *resolvedName != "" {
			detailMap["player_name"] = *resolvedName
		}
	}

	query := `
		INSERT INTO match_events (match_id, team_id, player_id, type, minute, detail)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`
	detailBytes, _ := json.Marshal(detailMap)
	err := r.db.QueryRow(ctx, query,
		e.MatchID, e.TeamID, e.PlayerID, eventType, e.Minute, detailBytes,
	).Scan(&e.ID, &e.CreatedAt)
	if err != nil {
		return err
	}

	e.Detail = detailMap
	e.ExtraInfo = detailMap
	if pn, ok := detailMap["player_name"].(string); ok && pn != "" {
		e.PlayerName = &pn
	}
	if tn, ok := detailMap["team_name"].(string); ok && tn != "" {
		e.TeamName = &tn
	}
	if tl, ok := detailMap["team_logo"].(string); ok && tl != "" {
		e.TeamLogo = &tl
	}
	return nil
}

func (r *MatchRepository) ListEvents(ctx context.Context, matchID uuid.UUID) ([]*model.MatchEvent, error) {
	query := `
		SELECT id, match_id, team_id, player_id, type, minute, detail, created_at
		FROM match_events
		WHERE match_id = $1 AND deleted_at IS NULL
		ORDER BY minute ASC, created_at ASC
	`
	rows, err := r.db.Query(ctx, query, matchID)
	if err != nil {
		return nil, fmt.Errorf("failed to query match events: %w", err)
	}
	defer rows.Close()

	var events []*model.MatchEvent
	for rows.Next() {
		var e model.MatchEvent
		var detailBytes []byte
		if err := rows.Scan(&e.ID, &e.MatchID, &e.TeamID, &e.PlayerID, &e.Type, &e.Minute, &detailBytes, &e.CreatedAt); err != nil {
			return nil, err
		}
		e.EventType = e.Type
		if len(detailBytes) > 0 {
			_ = json.Unmarshal(detailBytes, &e.Detail)
			e.ExtraInfo = e.Detail
		}
		events = append(events, &e)
	}
	return events, nil
}

func (r *MatchRepository) GetEventsByTournament(ctx context.Context, tournamentID uuid.UUID, categoryID *uuid.UUID) ([]*model.MatchEvent, error) {
	query := `
		SELECT me.id, me.match_id, me.team_id, me.player_id, me.type, me.minute, me.detail, me.created_at,
		       COALESCE(
		           NULLIF(me.detail->>'player_name', ''),
		           NULLIF(TRIM(p.first_name || ' ' || p.last_name), ''),
		           NULLIF(TRIM(CONCAT(mp_tp.first_name_local, ' ', CASE WHEN mp_tp.last_name_local = '-' THEN '' ELSE mp_tp.last_name_local END)), ''),
		           NULLIF(TRIM(CONCAT(mp_tp.first_name_intl, ' ', CASE WHEN mp_tp.last_name_intl = '-' THEN '' ELSE mp_tp.last_name_intl END)), ''),
		           NULLIF(TRIM(CONCAT(mp_tp.first_name_th, ' ', CASE WHEN mp_tp.last_name_th = '-' THEN '' ELSE mp_tp.last_name_th END)), ''),
		           NULLIF(TRIM(CONCAT(mp_tp.first_name_en, ' ', CASE WHEN mp_tp.last_name_en = '-' THEN '' ELSE mp_tp.last_name_en END)), ''),
		           NULLIF(TRIM(CONCAT(mp_direct.first_name_local, ' ', CASE WHEN mp_direct.last_name_local = '-' THEN '' ELSE mp_direct.last_name_local END)), ''),
		           NULLIF(TRIM(CONCAT(mp_direct.first_name_intl, ' ', CASE WHEN mp_direct.last_name_intl = '-' THEN '' ELSE mp_direct.last_name_intl END)), ''),
		           NULLIF(TRIM(CONCAT(mp_direct.first_name_th, ' ', CASE WHEN mp_direct.last_name_th = '-' THEN '' ELSE mp_direct.last_name_th END)), ''),
		           NULLIF(TRIM(CONCAT(mp_direct.first_name_en, ' ', CASE WHEN mp_direct.last_name_en = '-' THEN '' ELSE mp_direct.last_name_en END)), '')
		       ) AS player_name,
		       COALESCE(t.name, tt_team.name) AS team_name,
		       COALESCE(t.logo_url, tt_team.logo_url) AS team_logo
		FROM match_events me
		JOIN matches m ON me.match_id = m.id
		JOIN tournament_categories tc ON m.category_id = tc.id
		LEFT JOIN players p ON me.player_id = p.id
		LEFT JOIN tournament_players tp ON (
			me.player_id = tp.id OR
			(p.master_player_id IS NOT NULL AND tp.master_player_id = p.master_player_id)
		)
		LEFT JOIN master_players mp_tp ON tp.master_player_id = mp_tp.id
		LEFT JOIN master_players mp_direct ON me.player_id = mp_direct.id
		LEFT JOIN teams t ON me.team_id = t.id
		LEFT JOIN tournament_teams tt ON me.team_id = tt.id
		LEFT JOIN teams tt_team ON tt.team_id = tt_team.id
		WHERE tc.tournament_id = $1
		  AND me.deleted_at IS NULL
		  AND ($2::uuid IS NULL OR m.category_id = $2)
		ORDER BY me.minute ASC, me.created_at ASC
	`
	rows, err := r.db.Query(ctx, query, tournamentID, categoryID)
	if err != nil {
		return nil, fmt.Errorf("failed to query tournament events: %w", err)
	}
	defer rows.Close()

	var events []*model.MatchEvent
	for rows.Next() {
		var e model.MatchEvent
		var detailBytes []byte
		var playerName *string
		var teamName *string
		var teamLogo *string
		if err := rows.Scan(&e.ID, &e.MatchID, &e.TeamID, &e.PlayerID, &e.Type, &e.Minute, &detailBytes, &e.CreatedAt, &playerName, &teamName, &teamLogo); err != nil {
			return nil, err
		}
		e.EventType = e.Type
		if len(detailBytes) > 0 {
			_ = json.Unmarshal(detailBytes, &e.Detail)
		}
		if e.Detail == nil {
			e.Detail = make(map[string]interface{})
		}
		e.PlayerName = playerName
		e.TeamName = teamName
		e.TeamLogo = teamLogo

		if playerName != nil && *playerName != "" {
			if e.Detail["player_name"] == nil || e.Detail["player_name"] == "" {
				e.Detail["player_name"] = *playerName
			}
		}
		if teamName != nil && *teamName != "" {
			if e.Detail["team_name"] == nil || e.Detail["team_name"] == "" {
				e.Detail["team_name"] = *teamName
			}
		}
		if teamLogo != nil && *teamLogo != "" {
			if e.Detail["team_logo"] == nil || e.Detail["team_logo"] == "" {
				e.Detail["team_logo"] = *teamLogo
			}
		}
		e.ExtraInfo = e.Detail
		events = append(events, &e)
	}
	return events, nil
}

func (r *MatchRepository) DeleteEvent(ctx context.Context, id uuid.UUID) (*uuid.UUID, error) {
	var matchID uuid.UUID
	query := `DELETE FROM match_events WHERE id = $1 RETURNING match_id`
	err := r.db.QueryRow(ctx, query, id).Scan(&matchID)
	if err != nil {
		return nil, err
	}
	return &matchID, nil
}

func (r *MatchRepository) DeleteByCategory(ctx context.Context, categoryID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM matches WHERE category_id = $1 OR tournament_category_id = $1`, categoryID)
	return err
}
