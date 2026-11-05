package service

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"tourni-backend/internal/model"
	"tourni-backend/internal/repository"
)

type TournamentService struct {
	repo *repository.TournamentRepository
}

func NewTournamentService(repo *repository.TournamentRepository) *TournamentService {
	return &TournamentService{repo: repo}
}

type CreateTournamentInput struct {
	Name             string                 `json:"name"`
	SportID          interface{}            `json:"sport_id,omitempty"`
	Description      *string                `json:"description,omitempty"`
	Format           model.TournamentFormat `json:"format"`
	StartDate        string                 `json:"start_date"`
	EndDate          string                 `json:"end_date"`
	DocumentDeadline *string                `json:"document_deadline,omitempty"`
	Location         *string                `json:"location,omitempty"`
	BannerURL        *string                `json:"banner_url,omitempty"`
	LogoURL          *string                `json:"logo_url,omitempty"`
	Rules            *string                `json:"rules,omitempty"`
	Settings         map[string]interface{} `json:"settings"`
	Categories       []CreateCategoryInput  `json:"categories,omitempty"`
}

func parseSportID(raw interface{}) *int {
	if raw == nil {
		return nil
	}
	switch v := raw.(type) {
	case float64:
		i := int(v)
		if i > 0 {
			return &i
		}
	case int:
		if v > 0 {
			return &v
		}
	case string:
		str := strings.TrimSpace(v)
		if i, err := strconv.Atoi(str); err == nil && i > 0 {
			return &i
		}
	}
	return nil
}

type CreateCategoryInput struct {
	Name            string                 `json:"name"`
	TeamLimit       int                    `json:"team_limit"`
	MaxTeams        int                    `json:"max_teams"`
	GenderType      string                 `json:"gender_type"`
	Gender          string                 `json:"gender"`
	MinAge          *int                   `json:"min_age,omitempty"`
	MaxAge          *int                   `json:"max_age,omitempty"`
	AgeCategoryID   *int                   `json:"age_category_id,omitempty"`
	RegistrationFee float64                `json:"registration_fee"`
	CanvasData      map[string]interface{} `json:"canvas_data,omitempty"`
	RulesConfig     map[string]interface{} `json:"rules_config,omitempty"`
}

func (s *TournamentService) List(ctx context.Context, status string, organizerID *uuid.UUID) ([]*model.Tournament, error) {
	return s.repo.List(ctx, status, organizerID)
}

func (s *TournamentService) GetByID(ctx context.Context, id uuid.UUID) (*model.Tournament, []*model.TournamentCategory, error) {
	tournament, err := s.repo.GetByID(ctx, id)
	if err != nil || tournament == nil {
		return nil, nil, err
	}

	categories, err := s.repo.GetCategories(ctx, id)
	if err != nil {
		return tournament, nil, err
	}

	return tournament, categories, nil
}

func (s *TournamentService) Create(ctx context.Context, organizerID uuid.UUID, input CreateTournamentInput) (*model.Tournament, error) {
	slug := strings.ToLower(strings.ReplaceAll(input.Name, " ", "-"))
	slug = fmt.Sprintf("%s-%s", slug, uuid.New().String()[:8])

	if input.Format == "" {
		input.Format = model.FormatGroupStageKnockout
	}
	if input.Settings == nil {
		input.Settings = make(map[string]interface{})
	}

	docDeadline := input.DocumentDeadline
	if docDeadline == nil {
		if val, ok := input.Settings["document_deadline"].(string); ok && val != "" {
			docDeadline = &val
		}
	}
	delete(input.Settings, "document_deadline")

	var sportID *int
	if input.SportID != nil {
		sportID = parseSportID(input.SportID)
	} else if val, ok := input.Settings["sport_id"]; ok && val != nil {
		sportID = parseSportID(val)
	}

	tournament := &model.Tournament{
		OrganizerID:    organizerID,
		SportID:        sportID,
		Name:           input.Name,
		Slug:           slug,
		Description:    input.Description,
		Format:         input.Format,
		Status:         model.StatusDraft,
		StartDate:      input.StartDate,
		EndDate:        input.EndDate,
		DocDeadlineStr: docDeadline,
		Location:       input.Location,
		BannerURL:      input.BannerURL,
		LogoURL:        input.LogoURL,
		Rules:          input.Rules,
		Settings:       input.Settings,
	}

	if err := s.repo.Create(ctx, tournament); err != nil {
		return nil, err
	}

	// Create categories if provided
	for _, catInput := range input.Categories {
		_, _ = s.CreateCategory(ctx, tournament.ID, catInput)
	}

	return tournament, nil
}

func (s *TournamentService) Update(ctx context.Context, t *model.Tournament) error {
	return s.repo.Update(ctx, t)
}

func (s *TournamentService) UpdateStatus(ctx context.Context, id uuid.UUID, status model.TournamentStatus) error {
	return s.repo.UpdateStatus(ctx, id, status)
}

func (s *TournamentService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

func (s *TournamentService) CreateCategory(ctx context.Context, tournamentID uuid.UUID, input CreateCategoryInput) (*model.TournamentCategory, error) {
	if input.MaxTeams == 0 {
		input.MaxTeams = input.TeamLimit
	}
	if input.MaxTeams == 0 {
		input.MaxTeams = 16
	}
	if input.TeamLimit == 0 {
		input.TeamLimit = input.MaxTeams
	}
	gender := input.GenderType
	if gender == "" {
		gender = input.Gender
	}
	if gender == "" {
		gender = "open"
	}

	ageCatID := input.AgeCategoryID
	if (ageCatID == nil || *ageCatID <= 0) && input.Name != "" {
		id, err := s.repo.GetOrCreateAgeCategory(ctx, input.Name, input.MinAge, input.MaxAge)
		if err == nil && id > 0 {
			ageCatID = &id
		}
	}

	category := &model.TournamentCategory{
		TournamentID:    tournamentID,
		Name:            input.Name,
		TeamLimit:       input.TeamLimit,
		MaxTeams:        input.MaxTeams,
		GenderType:      gender,
		AgeCategoryID:   ageCatID,
		RegistrationFee: input.RegistrationFee,
		CanvasData:      input.CanvasData,
		RulesConfig:     input.RulesConfig,
	}
	if err := s.repo.CreateCategory(ctx, category); err != nil {
		return nil, err
	}
	return category, nil
}

func (s *TournamentService) GetCategories(ctx context.Context, tournamentID uuid.UUID) ([]*model.TournamentCategory, error) {
	return s.repo.GetCategories(ctx, tournamentID)
}

func (s *TournamentService) GetCategoryByID(ctx context.Context, categoryID uuid.UUID) (*model.TournamentCategory, error) {
	return s.repo.GetCategoryByID(ctx, categoryID)
}

func (s *TournamentService) UpdateCategory(ctx context.Context, cat *model.TournamentCategory) error {
	return s.repo.UpdateCategory(ctx, cat)
}

func (s *TournamentService) UpdateCategoryCanvas(ctx context.Context, categoryID uuid.UUID, canvasData map[string]interface{}) error {
	return s.repo.UpdateCategoryCanvasData(ctx, categoryID, canvasData)
}

func (s *TournamentService) DeleteCategory(ctx context.Context, categoryID uuid.UUID) error {
	return s.repo.DeleteCategory(ctx, categoryID)
}

func (s *TournamentService) RequestStatusChange(ctx context.Context, req *model.TournamentStatusRequest) error {
	return s.repo.CreateStatusRequest(ctx, req)
}

func (s *TournamentService) CancelStatusRequest(ctx context.Context, tournamentID, userID uuid.UUID) error {
	return s.repo.CancelStatusRequest(ctx, tournamentID, userID)
}

func (s *TournamentService) GetLatestStatusRequest(ctx context.Context, tournamentID uuid.UUID) (*model.TournamentStatusRequest, error) {
	return s.repo.GetLatestStatusRequest(ctx, tournamentID)
}

func (s *TournamentService) ListAdminStatusRequests(ctx context.Context) ([]*model.TournamentStatusRequest, error) {
	return s.repo.ListAdminStatusRequests(ctx)
}

func (s *TournamentService) ListMyStatusRequests(ctx context.Context, userID uuid.UUID) ([]*model.TournamentStatusRequest, error) {
	return s.repo.ListMyStatusRequests(ctx, userID)
}

func (s *TournamentService) ApproveStatusRequest(ctx context.Context, tournamentID, reviewedBy uuid.UUID) (*model.TournamentStatusRequest, error) {
	return s.repo.ApproveStatusRequest(ctx, tournamentID, reviewedBy)
}

func (s *TournamentService) RejectStatusRequest(ctx context.Context, tournamentID, reviewedBy uuid.UUID, rejectReason string) (*model.TournamentStatusRequest, error) {
	return s.repo.RejectStatusRequest(ctx, tournamentID, reviewedBy, rejectReason)
}
