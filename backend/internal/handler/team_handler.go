package handler

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"tourni-backend/internal/model"
	"tourni-backend/internal/service"
)

type TeamHandler struct {
	teamService *service.TeamService
}

func NewTeamHandler(teamService *service.TeamService) *TeamHandler {
	return &TeamHandler{teamService: teamService}
}

type teamPayload struct {
	Name           string                 `json:"name"`
	ShortName      *string                `json:"short_name,omitempty"`
	Description    *string                `json:"description,omitempty"`
	LogoURL        *string                `json:"logo_url,omitempty"`
	LogoImg        *string                `json:"logo_img,omitempty"`
	ContactName    *string                `json:"contact_name,omitempty"`
	ContactPhone   *string                `json:"contact_phone,omitempty"`
	ContactEmail   *string                `json:"contact_email,omitempty"`
	IsRosterLocked bool                   `json:"is_roster_locked"`
	SportID        interface{}            `json:"sport_id,omitempty"`
	Sport          string                 `json:"sport,omitempty"`
	ContactInfo    map[string]interface{} `json:"contact_info,omitempty"`
}

func parseSportID(raw interface{}) *int {
	if raw == nil {
		defaultID := 1
		return &defaultID
	}
	switch v := raw.(type) {
	case float64:
		i := int(v)
		if i <= 0 {
			i = 1
		}
		return &i
	case int:
		if v <= 0 {
			v = 1
		}
		return &v
	case string:
		str := strings.TrimSpace(v)
		if str == "" {
			defaultID := 1
			return &defaultID
		}
		if i, err := strconv.Atoi(str); err == nil && i > 0 {
			return &i
		}
		lower := strings.ToLower(str)
		var id int
		if strings.Contains(lower, "volley") || strings.Contains(lower, "วอลเลย์") || strings.Contains(lower, "e193797b") {
			id = 2
		} else if strings.Contains(lower, "basket") || strings.Contains(lower, "บาส") || strings.Contains(lower, "ed6d32f4") {
			id = 3
		} else if strings.Contains(lower, "futsal") || strings.Contains(lower, "ฟุตซอล") || strings.Contains(lower, "f193797b") {
			id = 4
		} else if strings.Contains(lower, "badminton") || strings.Contains(lower, "แบดมินตัน") || strings.Contains(lower, "b193797b") {
			id = 5
		} else if strings.Contains(lower, "tennis") || strings.Contains(lower, "เทนนิส") || strings.Contains(lower, "t193797b") {
			id = 6
		} else if strings.Contains(lower, "takraw") || strings.Contains(lower, "ตะกร้อ") || strings.Contains(lower, "s193797b") {
			id = 7
		} else if strings.Contains(lower, "cricket") || strings.Contains(lower, "คริกเก็ต") || strings.Contains(lower, "c193797b") {
			id = 8
		} else {
			id = 1 // default Football
		}
		return &id
	default:
		defaultID := 1
		return &defaultID
	}
}

func (h *TeamHandler) List(c *fiber.Ctx) error {
	var userIDPtr *uuid.UUID
	if userIDStr := c.Query("user_id"); userIDStr != "" {
		if uID, err := uuid.Parse(userIDStr); err == nil {
			userIDPtr = &uID
		}
	}

	teams, err := h.teamService.ListTeams(c.Context(), userIDPtr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if teams == nil {
		teams = []*model.Team{}
	}
	return c.JSON(teams)
}

func (h *TeamHandler) GetByID(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid team ID"})
	}

	team, err := h.teamService.GetTeamByID(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if team == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Team not found"})
	}
	return c.JSON(team)
}

func (h *TeamHandler) Create(c *fiber.Ctx) error {
	var input teamPayload
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload: " + err.Error()})
	}

	if strings.TrimSpace(input.Name) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Team name is required"})
	}

	team := model.Team{
		Name:           strings.TrimSpace(input.Name),
		ShortName:      input.ShortName,
		Description:    input.Description,
		LogoURL:        input.LogoURL,
		LogoImg:        input.LogoImg,
		ContactName:    input.ContactName,
		ContactPhone:   input.ContactPhone,
		ContactEmail:   input.ContactEmail,
		IsRosterLocked: input.IsRosterLocked,
		SportID:        parseSportID(input.SportID),
		Sport:          input.Sport,
		ContactInfo:    input.ContactInfo,
	}

	if team.ContactInfo == nil {
		team.ContactInfo = make(map[string]interface{})
	}
	if team.ContactName != nil && *team.ContactName != "" {
		team.ContactInfo["contact_name"] = *team.ContactName
	}
	if team.ContactPhone != nil && *team.ContactPhone != "" {
		team.ContactInfo["contact_phone"] = *team.ContactPhone
	}
	if team.ContactEmail != nil && *team.ContactEmail != "" {
		team.ContactInfo["contact_email"] = *team.ContactEmail
	}

	// Set user_id from auth token if present
	if userIDVal := c.Locals("user_id"); userIDVal != nil {
		if uID, ok := userIDVal.(uuid.UUID); ok && team.UserID == nil {
			team.UserID = &uID
			team.CreatedBy = &uID
		}
	}

	if err := h.teamService.CreateTeam(c.Context(), &team); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(team)
}

func (h *TeamHandler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid team ID"})
	}

	var input teamPayload
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload: " + err.Error()})
	}

	team := model.Team{
		ID:             id,
		Name:           strings.TrimSpace(input.Name),
		ShortName:      input.ShortName,
		Description:    input.Description,
		LogoURL:        input.LogoURL,
		LogoImg:        input.LogoImg,
		ContactName:    input.ContactName,
		ContactPhone:   input.ContactPhone,
		ContactEmail:   input.ContactEmail,
		IsRosterLocked: input.IsRosterLocked,
		SportID:        parseSportID(input.SportID),
		Sport:          input.Sport,
		ContactInfo:    input.ContactInfo,
	}

	if team.ContactInfo == nil {
		team.ContactInfo = make(map[string]interface{})
	}

	if err := h.teamService.UpdateTeam(c.Context(), &team); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Team updated successfully", "team": team})
}

func (h *TeamHandler) LockRoster(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid team ID"})
	}

	var req struct {
		IsLocked       bool  `json:"is_locked"`
		IsRosterLocked *bool `json:"is_roster_locked"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	locked := req.IsLocked
	if req.IsRosterLocked != nil {
		locked = *req.IsRosterLocked
	}

	if err := h.teamService.LockRoster(c.Context(), id, locked); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Team roster lock status updated", "is_roster_locked": locked})
}

func (h *TeamHandler) Delete(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid team ID"})
	}

	if err := h.teamService.DeleteTeam(c.Context(), id); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Team deleted successfully"})
}

// Players subroutes
func (h *TeamHandler) GetPlayers(c *fiber.Ctx) error {
	teamID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid team ID"})
	}

	players, err := h.teamService.GetTeamPlayers(c.Context(), teamID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if players == nil {
		players = []*model.Player{}
	}
	return c.JSON(players)
}

func (h *TeamHandler) AddPlayer(c *fiber.Ctx) error {
	teamID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid team ID"})
	}

	var p model.Player
	if err := c.BodyParser(&p); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	p.TeamID = teamID

	if err := h.teamService.AddPlayer(c.Context(), &p); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(p)
}

func (h *TeamHandler) UpdatePlayer(c *fiber.Ctx) error {
	playerID, err := uuid.Parse(c.Params("playerId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid player ID"})
	}

	var p model.Player
	if err := c.BodyParser(&p); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	p.ID = playerID

	if err := h.teamService.UpdatePlayer(c.Context(), &p); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(p)
}

func (h *TeamHandler) DeletePlayer(c *fiber.Ctx) error {
	playerID, err := uuid.Parse(c.Params("playerId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid player ID"})
	}

	if err := h.teamService.DeletePlayer(c.Context(), playerID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Player removed successfully"})
}

func (h *TeamHandler) ResetRoster(c *fiber.Ctx) error {
	teamID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid team ID"})
	}

	if err := h.teamService.ResetRoster(c.Context(), teamID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Roster reset successfully", "success": true})
}

func (h *TeamHandler) RestoreRoster(c *fiber.Ctx) error {
	teamID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid team ID"})
	}

	if err := h.teamService.RestoreRoster(c.Context(), teamID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"message": "Roster restored successfully", "success": true})
}

func (h *TeamHandler) HasSoftDeletedPlayers(c *fiber.Ctx) error {
	teamID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid team ID"})
	}

	hasDeleted, err := h.teamService.HasSoftDeletedPlayers(c.Context(), teamID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"has_deleted": hasDeleted, "success": true})
}

