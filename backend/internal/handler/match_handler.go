package handler

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"tourni-backend/internal/model"
	"tourni-backend/internal/service"
)

type MatchHandler struct {
	matchService *service.MatchService
}

func NewMatchHandler(matchService *service.MatchService) *MatchHandler {
	return &MatchHandler{matchService: matchService}
}

func (h *MatchHandler) GetByID(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid match ID"})
	}

	match, err := h.matchService.GetByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if match == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Match not found"})
	}

	return c.JSON(match)
}

func (h *MatchHandler) Create(c *fiber.Ctx) error {
	var m model.Match
	if err := c.BodyParser(&m); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	if m.Status == "" {
		m.Status = model.MatchScheduled
	}

	if err := h.matchService.Create(c.Context(), &m); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(m)
}

func (h *MatchHandler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid match ID"})
	}

	var m model.Match
	if err := c.BodyParser(&m); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	m.ID = id

	// Check which fields were actually present in the request body
	// to avoid zeroing out omitted fields (e.g. elapsed_seconds, scores)
	var rawMap map[string]interface{}
	if err := json.Unmarshal(c.Body(), &rawMap); err == nil && rawMap != nil {
		existing, err := h.matchService.GetByID(c.Context(), id)
		if err == nil && existing != nil {
			if _, hasHomeScore := rawMap["home_score"]; !hasHomeScore {
				m.HomeScore = existing.HomeScore
			}
			if _, hasAwayScore := rawMap["away_score"]; !hasAwayScore {
				m.AwayScore = existing.AwayScore
			}
			_, hasElapsedSeconds := rawMap["elapsed_seconds"]
			_, hasElapsedBeforePause := rawMap["elapsed_before_pause"]
			if !hasElapsedSeconds && !hasElapsedBeforePause {
				m.ElapsedSeconds = existing.ElapsedSeconds
				m.ElapsedBeforePause = existing.ElapsedBeforePause
			}

			if m.ScoreDetail == nil {
				if existing.ScoreDetail != nil {
					m.ScoreDetail = make(map[string]interface{})
					for k, v := range existing.ScoreDetail {
						m.ScoreDetail[k] = v
					}
				} else {
					m.ScoreDetail = make(map[string]interface{})
				}
			}
			if ph, ok := rawMap["penalty_home_score"]; ok {
				m.ScoreDetail["penalty_home_score"] = ph
				m.ScoreDetail["home_penalty_score"] = ph
			} else if ph, ok := rawMap["home_penalty_score"]; ok {
				m.ScoreDetail["penalty_home_score"] = ph
				m.ScoreDetail["home_penalty_score"] = ph
			}
			if pa, ok := rawMap["penalty_away_score"]; ok {
				m.ScoreDetail["penalty_away_score"] = pa
				m.ScoreDetail["away_penalty_score"] = pa
			} else if pa, ok := rawMap["away_penalty_score"]; ok {
				m.ScoreDetail["penalty_away_score"] = pa
				m.ScoreDetail["away_penalty_score"] = pa
			}
			if wid, ok := rawMap["winner_id"]; ok && wid != nil {
				m.ScoreDetail["winner_id"] = wid
			}
		}
	}

	if m.Status == "finished" || m.Status == "completed" || m.Status == model.MatchFinished {
		m.TimerStatus = "stopped"
	}

	if err := h.matchService.Update(c.Context(), &m); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Match updated successfully", "match": m})
}

func (h *MatchHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid match ID"})
	}

	if err := h.matchService.Delete(c.Context(), id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Match deleted successfully"})
}

func (h *MatchHandler) GetByCategory(c *fiber.Ctx) error {
	catID, err := uuid.Parse(c.Params("categoryId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid category ID"})
	}

	matches, err := h.matchService.GetMatchesByCategory(c.Context(), catID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if matches == nil {
		matches = []*model.Match{}
	}
	return c.JSON(matches)
}

func (h *MatchHandler) SyncCategoryMatches(c *fiber.Ctx) error {
	catID, err := uuid.Parse(c.Params("categoryId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid category ID"})
	}

	var req struct {
		Matches  []*model.Match `json:"matches"`
		ValidIDs []uuid.UUID    `json:"valid_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	synced, err := h.matchService.SyncCategoryMatches(c.Context(), catID, req.Matches, req.ValidIDs)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if synced == nil {
		synced = []*model.Match{}
	}
	return c.JSON(fiber.Map{
		"message": "Matches synced successfully",
		"matches": synced,
	})
}

func (h *MatchHandler) GetByTournament(c *fiber.Ctx) error {
	tID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid tournament ID"})
	}

	matches, err := h.matchService.GetMatchesByTournament(c.Context(), tID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if matches == nil {
		matches = []*model.Match{}
	}
	return c.JSON(matches)
}

func (h *MatchHandler) GetEventsByTournament(c *fiber.Ctx) error {
	tID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid tournament ID"})
	}

	var categoryID *uuid.UUID
	catParam := c.Query("category_id")
	if catParam != "" {
		if parsed, err := uuid.Parse(catParam); err == nil {
			categoryID = &parsed
		}
	}

	events, err := h.matchService.GetEventsByTournament(c.Context(), tID, categoryID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if events == nil {
		events = []*model.MatchEvent{}
	}
	return c.JSON(events)
}

func (h *MatchHandler) UpdateScore(c *fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid match ID"})
	}

	var req struct {
		HomeScore int               `json:"home_score"`
		AwayScore int               `json:"away_score"`
		Status    model.MatchStatus `json:"status"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request payload"})
	}

	match, err := h.matchService.UpdateScore(c.Context(), id, req.HomeScore, req.AwayScore, req.Status)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(match)
}

// Match Events
func (h *MatchHandler) AddEvent(c *fiber.Ctx) error {
	matchID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid match ID"})
	}

	var e model.MatchEvent
	if err := c.BodyParser(&e); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	e.MatchID = matchID

	if err := h.matchService.AddEvent(c.Context(), &e); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(e)
}

func (h *MatchHandler) ListEvents(c *fiber.Ctx) error {
	matchID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid match ID"})
	}

	events, err := h.matchService.ListEvents(c.Context(), matchID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if events == nil {
		events = []*model.MatchEvent{}
	}
	return c.JSON(events)
}

func (h *MatchHandler) DeleteEvent(c *fiber.Ctx) error {
	eventID, err := uuid.Parse(c.Params("eventId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid event ID"})
	}

	if err := h.matchService.DeleteEvent(c.Context(), eventID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Match event deleted successfully"})
}

func (h *MatchHandler) DeleteByCategory(c *fiber.Ctx) error {
	catID, err := uuid.Parse(c.Params("categoryId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid category ID"})
	}

	if err := h.matchService.DeleteByCategory(c.Context(), catID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Category matches deleted successfully", "success": true})
}
