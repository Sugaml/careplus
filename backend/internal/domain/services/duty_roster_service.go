package services

import (
	"context"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type dutyRosterService struct {
	rosterRepo outbound.DutyRosterRepository
	userRepo   outbound.UserRepository
	logger     *zap.Logger
}

func NewDutyRosterService(rosterRepo outbound.DutyRosterRepository, userRepo outbound.UserRepository, logger *zap.Logger) inbound.DutyRosterService {
	return &dutyRosterService{rosterRepo: rosterRepo, userRepo: userRepo, logger: logger}
}

func (s *dutyRosterService) Create(ctx context.Context, pharmacyID uuid.UUID, userID uuid.UUID, date time.Time, shiftType models.ShiftType, notes string) (*models.DutyRoster, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return nil, errors.ErrNotFound("user")
	}
	if user.PharmacyID != pharmacyID {
		return nil, errors.ErrForbidden("user not in pharmacy")
	}
	if user.Role != RolePharmacist {
		return nil, errors.ErrForbidden("duty roster can only assign pharmacists")
	}
	d := &models.DutyRoster{
		PharmacyID: pharmacyID,
		UserID:     userID,
		Date:       time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location()),
		ShiftType:  shiftType,
		Notes:      notes,
	}
	if err := s.rosterRepo.Create(ctx, d); err != nil {
		return nil, errors.ErrInternal("failed to create duty roster", err)
	}
	return s.rosterRepo.GetByID(ctx, d.ID)
}

func (s *dutyRosterService) GetByID(ctx context.Context, pharmacyID uuid.UUID, id uuid.UUID) (*models.DutyRoster, error) {
	d, err := s.rosterRepo.GetByID(ctx, id)
	if err != nil || d == nil {
		return nil, errors.ErrNotFound("duty roster")
	}
	if d.PharmacyID != pharmacyID {
		return nil, errors.ErrNotFound("duty roster")
	}
	return d, nil
}

func (s *dutyRosterService) ListByDateRange(ctx context.Context, pharmacyID uuid.UUID, from, to time.Time) ([]*models.DutyRoster, error) {
	return s.rosterRepo.ListByPharmacyAndDateRange(ctx, pharmacyID, from, to)
}

func (s *dutyRosterService) Update(ctx context.Context, pharmacyID uuid.UUID, id uuid.UUID, userID *uuid.UUID, date *time.Time, shiftType *models.ShiftType, notes *string) (*models.DutyRoster, error) {
	d, err := s.rosterRepo.GetByID(ctx, id)
	if err != nil || d == nil {
		return nil, errors.ErrNotFound("duty roster")
	}
	if d.PharmacyID != pharmacyID {
		return nil, errors.ErrNotFound("duty roster")
	}
	if userID != nil {
		user, err := s.userRepo.GetByID(ctx, *userID)
		if err != nil || user == nil || user.PharmacyID != pharmacyID || user.Role != RolePharmacist {
			return nil, errors.ErrForbidden("invalid pharmacist")
		}
		d.UserID = *userID
	}
	if date != nil {
		d.Date = time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	}
	if shiftType != nil {
		d.ShiftType = *shiftType
	}
	if notes != nil {
		d.Notes = *notes
	}
	if err := s.rosterRepo.Update(ctx, d); err != nil {
		return nil, errors.ErrInternal("failed to update duty roster", err)
	}
	return s.rosterRepo.GetByID(ctx, d.ID)
}

func (s *dutyRosterService) Delete(ctx context.Context, pharmacyID uuid.UUID, id uuid.UUID) error {
	d, err := s.rosterRepo.GetByID(ctx, id)
	if err != nil || d == nil {
		return errors.ErrNotFound("duty roster")
	}
	if d.PharmacyID != pharmacyID {
		return errors.ErrNotFound("duty roster")
	}
	return s.rosterRepo.Delete(ctx, id)
}
