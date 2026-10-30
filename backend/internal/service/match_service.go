package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"tourni-backend/internal/model"
	"tourni-backend/internal/repository"
	wsHub "tourni-backend/internal/websocket"
)

type MatchService struct {
	repo          *repository.MatchRepository
	hub           *wsHub.Hub
	standingsRepo *repository.StandingsRepository
}

func NewMatchService(repo *repository.MatchRepository, hub *wsHub.Hub, standingsRepo *repository.StandingsRepository) *MatchService {
	return &MatchService{
		repo:          repo,
		hub:           hub,
		standingsRepo: standingsRepo,
	}
}

func (s *MatchService) GetByID(ctx context.Context, id uuid.UUID) (*model.Match, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *MatchService) Create(ctx context.Context, m *model.Match) error {
	return s.repo.Create(ctx, m)
}

func (s *MatchService) Update(ctx context.Context, m *model.Match) error {
	if err := s.repo.Update(ctx, m); err != nil {
		return err
	}

	updatedMatch, err := s.repo.GetByID(ctx, m.ID)
	if err == nil && updatedMatch != nil {
		s.hub.BroadcastMatchUpdate(m.ID.String(), wsHub.EventMatchUpdate, map[string]interface{}{
			"match": updatedMatch,
		})
		s.hub.BroadcastMatchUpdate(m.ID.String(), wsHub.EventScoreUpdate, map[string]interface{}{
			"match_id":   m.ID.String(),
			"home_score": updatedMatch.HomeScore,
			"away_score": updatedMatch.AwayScore,
			"status":     string(updatedMatch.Status),
		})
		if m.Status != "" {
			s.hub.BroadcastMatchUpdate(m.ID.String(), wsHub.EventStatusChange, map[string]interface{}{
				"match_id": m.ID.String(),
				"status":   string(m.Status),
			})
		}
		if updatedMatch.TournamentCategoryID != nil && s.standingsRepo != nil {
			standingsService := NewStandingsService(s.standingsRepo, s.repo)
			newStandings, _ := standingsService.RecalculateAndSave(ctx, *updatedMatch.TournamentCategoryID)
			s.hub.BroadcastMatchUpdate("all", wsHub.EventStandingsSync, map[string]interface{}{
				"category_id": updatedMatch.TournamentCategoryID.String(),
				"standings":   newStandings,
			})
		}
	}

	return nil
}

func (s *MatchService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

func (s *MatchService) GetMatchesByCategory(ctx context.Context, categoryID uuid.UUID) ([]*model.Match, error) {
	return s.repo.GetMatchesByCategory(ctx, categoryID)
}

func (s *MatchService) GetMatchesByTournament(ctx context.Context, tournamentID uuid.UUID) ([]*model.Match, error) {
	return s.repo.GetMatchesByTournament(ctx, tournamentID)
}

func (s *MatchService) SyncCategoryMatches(ctx context.Context, categoryID uuid.UUID, matches []*model.Match, validIDs []uuid.UUID) ([]*model.Match, error) {
	return s.repo.SyncCategoryMatches(ctx, categoryID, matches, validIDs)
}

func (s *MatchService) UpdateScore(ctx context.Context, id uuid.UUID, homeScore, awayScore int, status model.MatchStatus) (*model.Match, error) {
	if status == "" {
		status = model.MatchSecondHalf
	}

	if err := s.repo.UpdateScore(ctx, id, homeScore, awayScore, status); err != nil {
		return nil, fmt.Errorf("failed to update match score: %w", err)
	}

	match, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Real-time WebSocket Broadcast
	s.hub.BroadcastMatchUpdate(id.String(), wsHub.EventScoreUpdate, map[string]interface{}{
		"match_id":   id.String(),
		"home_score": homeScore,
		"away_score": awayScore,
		"status":     status,
	})
	s.hub.BroadcastMatchUpdate(id.String(), wsHub.EventMatchUpdate, map[string]interface{}{
		"match": match,
	})
	if status != "" {
		s.hub.BroadcastMatchUpdate(id.String(), wsHub.EventStatusChange, map[string]interface{}{
			"match_id": id.String(),
			"status":   string(status),
		})
	}

	// If match belongs to a tournament category, recalculate and persist standings
	if match.TournamentCategoryID != nil && s.standingsRepo != nil {
		standingsService := NewStandingsService(s.standingsRepo, s.repo)
		newStandings, _ := standingsService.RecalculateAndSave(ctx, *match.TournamentCategoryID)
		s.hub.BroadcastMatchUpdate("all", wsHub.EventStandingsSync, map[string]interface{}{
			"category_id": match.TournamentCategoryID.String(),
			"standings":   newStandings,
		})
	}

	return match, nil
}

func (s *MatchService) AddEvent(ctx context.Context, e *model.MatchEvent) error {
	if err := s.repo.AddEvent(ctx, e); err != nil {
		return err
	}
	s.hub.BroadcastMatchUpdate(e.MatchID.String(), wsHub.EventMatchEvent, map[string]interface{}{
		"event": e,
	})
	return nil
}

func (s *MatchService) ListEvents(ctx context.Context, matchID uuid.UUID) ([]*model.MatchEvent, error) {
	return s.repo.ListEvents(ctx, matchID)
}

func (s *MatchService) GetEventsByTournament(ctx context.Context, tournamentID uuid.UUID, categoryID *uuid.UUID) ([]*model.MatchEvent, error) {
	return s.repo.GetEventsByTournament(ctx, tournamentID, categoryID)
}

func (s *MatchService) DeleteEvent(ctx context.Context, id uuid.UUID) error {
	matchID, err := s.repo.DeleteEvent(ctx, id)
	if err != nil {
		return err
	}
	if matchID != nil {
		s.hub.BroadcastMatchUpdate(matchID.String(), wsHub.EventMatchEventDelete, map[string]interface{}{
			"event_id": id.String(),
			"match_id": matchID.String(),
		})
	}
	return nil
}

func (s *MatchService) DeleteByCategory(ctx context.Context, categoryID uuid.UUID) error {
	return s.repo.DeleteByCategory(ctx, categoryID)
}
