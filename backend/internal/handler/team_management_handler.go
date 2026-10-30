package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"tourni-backend/internal/model"
	"tourni-backend/internal/repository"
)

type TeamManagementHandler struct {
	repo *repository.TeamManagementRepository
}

func NewTeamManagementHandler(repo *repository.TeamManagementRepository) *TeamManagementHandler {
	return &TeamManagementHandler{repo: repo}
}

type SubmitManagementRequestInput struct {
	TeamID       uuid.UUID `json:"team_id"`
	ContactPhone string    `json:"contact_phone"`
	Message      *string   `json:"message"`
}

func (h *TeamManagementHandler) SubmitRequest(c *fiber.Ctx) error {
	var input SubmitManagementRequestInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if input.TeamID == uuid.Nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "team_id is required"})
	}
	if input.ContactPhone == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "contact_phone is required"})
	}

	// Extract user_id from token
	userIDVal := c.Locals("user_id")
	if userIDVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Authentication required"})
	}
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid user session"})
	}

	req := &model.TeamManagementRequest{
		TeamID:       input.TeamID,
		RequesterID:  userID,
		ContactPhone: input.ContactPhone,
		Message:      input.Message,
	}

	if err := h.repo.CreateOrUpdate(c.Context(), req); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "Team management request submitted successfully",
		"request": req,
	})
}

func (h *TeamManagementHandler) ListMyRequests(c *fiber.Ctx) error {
	userIDVal := c.Locals("user_id")
	if userIDVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Authentication required"})
	}
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid user session"})
	}

	requests, err := h.repo.ListByRequester(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if requests == nil {
		requests = []*model.TeamManagementRequest{}
	}
	return c.JSON(requests)
}

func (h *TeamManagementHandler) SearchTeams(c *fiber.Ctx) error {
	query := c.Query("q")
	if query == "" {
		query = c.Query("email")
	}

	var excludeUserID *uuid.UUID
	if userIDVal := c.Locals("user_id"); userIDVal != nil {
		if uID, ok := userIDVal.(uuid.UUID); ok {
			excludeUserID = &uID
		}
	}

	teams, err := h.repo.SearchTeamsForClaim(c.Context(), query, excludeUserID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if teams == nil {
		teams = []*model.Team{}
	}
	return c.JSON(teams)
}

func (h *TeamManagementHandler) ListIncomingRequests(c *fiber.Ctx) error {
	userIDVal := c.Locals("user_id")
	if userIDVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Authentication required"})
	}
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid user session"})
	}

	requests, err := h.repo.ListIncoming(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	if requests == nil {
		requests = []*model.TeamManagementRequest{}
	}
	return c.JSON(requests)
}

func (h *TeamManagementHandler) ApproveRequest(c *fiber.Ctx) error {
	reqIDStr := c.Params("id")
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request ID"})
	}

	if err := h.repo.Approve(c.Context(), reqID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Request approved successfully"})
}

func (h *TeamManagementHandler) RejectRequest(c *fiber.Ctx) error {
	reqIDStr := c.Params("id")
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request ID"})
	}

	if err := h.repo.Reject(c.Context(), reqID); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Request rejected successfully"})
}

func (h *TeamManagementHandler) CancelRequest(c *fiber.Ctx) error {
	userIDVal := c.Locals("user_id")
	if userIDVal == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Authentication required"})
	}
	userID, ok := userIDVal.(uuid.UUID)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid user session"})
	}

	role, _ := c.Locals("role").(string)
	isAdmin := role == "admin" || role == "super_admin"

	reqIDStr := c.Params("id")
	reqID, err := uuid.Parse(reqIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request ID"})
	}

	if err := h.repo.Cancel(c.Context(), reqID, userID, isAdmin); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Request cancelled successfully"})
}
