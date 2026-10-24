package service

import (
	"context"

	"github.com/google/uuid"

	"tourni-backend/internal/model"
	"tourni-backend/internal/repository"
)

type TeamService struct {
	teamRepo         *repository.TeamRepository
	masterPlayerRepo *repository.MasterPlayerRepository
}

func NewTeamService(teamRepo *repository.TeamRepository, masterPlayerRepo *repository.MasterPlayerRepository) *TeamService {
	return &TeamService{
		teamRepo:         teamRepo,
		masterPlayerRepo: masterPlayerRepo,
	}
}

func (s *TeamService) ListTeams(ctx context.Context, userID *uuid.UUID) ([]*model.Team, error) {
	return s.teamRepo.List(ctx, userID)
}

func (s *TeamService) GetTeamByID(ctx context.Context, id uuid.UUID) (*model.Team, error) {
	return s.teamRepo.GetByID(ctx, id)
}

func (s *TeamService) CreateTeam(ctx context.Context, team *model.Team) error {
	return s.teamRepo.Create(ctx, team)
}

func (s *TeamService) UpdateTeam(ctx context.Context, team *model.Team) error {
	return s.teamRepo.Update(ctx, team)
}

func (s *TeamService) DeleteTeam(ctx context.Context, id uuid.UUID) error {
	return s.teamRepo.Delete(ctx, id)
}

func (s *TeamService) GetTeamPlayers(ctx context.Context, teamID uuid.UUID) ([]*model.Player, error) {
	return s.teamRepo.GetPlayers(ctx, teamID)
}

func (s *TeamService) AddPlayer(ctx context.Context, p *model.Player) error {
	if s.masterPlayerRepo != nil {
		if p.MasterPlayerID != nil {
			// Fetch existing master player to sync photo or birth date if player has none
			if mp, err := s.masterPlayerRepo.GetByID(ctx, *p.MasterPlayerID); err == nil && mp != nil {
				if (p.PhotoURL == nil || *p.PhotoURL == "") && mp.PhotoURL != nil && *mp.PhotoURL != "" {
					p.PhotoURL = mp.PhotoURL
				}
				if (p.DateOfBirth == nil || *p.DateOfBirth == "") && mp.Birthday != nil && *mp.Birthday != "" {
					p.DateOfBirth = mp.Birthday
				}
			}
		} else {
			// Find existing master player by name
			mp, err := s.masterPlayerRepo.FindByName(ctx, p.FirstName, p.LastName)
			if err == nil && mp != nil {
				p.MasterPlayerID = &mp.ID
				if (p.PhotoURL == nil || *p.PhotoURL == "") && mp.PhotoURL != nil && *mp.PhotoURL != "" {
					p.PhotoURL = mp.PhotoURL
				}
				if (p.DateOfBirth == nil || *p.DateOfBirth == "") && mp.Birthday != nil && *mp.Birthday != "" {
					p.DateOfBirth = mp.Birthday
				}
			} else {
				// Create new master player
				var firstLocal, lastLocal, firstIntl, lastIntl *string
				if isASCII(p.FirstName) && (p.LastName == "" || isASCII(p.LastName)) {
					firstIntl = &p.FirstName
					lastIntl = &p.LastName
				} else {
					firstLocal = &p.FirstName
					lastLocal = &p.LastName
				}

				newMP := &model.MasterPlayer{
					FirstNameLocal: firstLocal,
					LastNameLocal:  lastLocal,
					FirstNameIntl:  firstIntl,
					LastNameIntl:   lastIntl,
					Birthday:       p.DateOfBirth,
					PhotoURL:       p.PhotoURL,
					Tel:            p.Tel,
				}
				if err := s.masterPlayerRepo.Create(ctx, newMP); err == nil {
					p.MasterPlayerID = &newMP.ID
				}
			}
		}
	}
	return s.teamRepo.AddPlayer(ctx, p)
}

func (s *TeamService) UpdatePlayer(ctx context.Context, p *model.Player) error {
	if err := s.teamRepo.UpdatePlayer(ctx, p); err != nil {
		return err
	}
	if s.masterPlayerRepo != nil {
		var masterID *uuid.UUID = p.MasterPlayerID
		if masterID == nil {
			if existingPlayer, err := s.teamRepo.GetPlayerByID(ctx, p.ID); err == nil && existingPlayer != nil {
				masterID = existingPlayer.MasterPlayerID
			}
		}
		if masterID != nil {
			if mp, err := s.masterPlayerRepo.GetByID(ctx, *masterID); err == nil && mp != nil {
				if p.FirstName != "" {
					if isASCII(p.FirstName) && (p.LastName == "" || isASCII(p.LastName)) {
						mp.FirstNameIntl = &p.FirstName
						if p.LastName != "" {
							mp.LastNameIntl = &p.LastName
						}
					} else {
						mp.FirstNameLocal = &p.FirstName
						if p.LastName != "" {
							mp.LastNameLocal = &p.LastName
						}
					}
				}
				if p.PhotoURL != nil && *p.PhotoURL != "" {
					mp.PhotoURL = p.PhotoURL
				}
				if p.DateOfBirth != nil && *p.DateOfBirth != "" {
					mp.Birthday = p.DateOfBirth
				}
				if p.Tel != nil && *p.Tel != "" {
					mp.Tel = p.Tel
				}
				_ = s.masterPlayerRepo.Update(ctx, mp)
			}
		}
	}
	return nil
}

func (s *TeamService) DeletePlayer(ctx context.Context, playerID uuid.UUID) error {
	return s.teamRepo.DeletePlayer(ctx, playerID)
}

func (s *TeamService) ResetRoster(ctx context.Context, teamID uuid.UUID) error {
	return s.teamRepo.ResetRoster(ctx, teamID)
}

func (s *TeamService) RestoreRoster(ctx context.Context, teamID uuid.UUID) error {
	return s.teamRepo.RestoreRoster(ctx, teamID)
}

func (s *TeamService) HasSoftDeletedPlayers(ctx context.Context, teamID uuid.UUID) (bool, error) {
	return s.teamRepo.HasSoftDeletedPlayers(ctx, teamID)
}

func (s *TeamService) LockRoster(ctx context.Context, teamID uuid.UUID, locked bool) error {
	return s.teamRepo.LockRoster(ctx, teamID, locked)
}

func isASCII(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] > 127 {
			return false
		}
	}
	return true
}

