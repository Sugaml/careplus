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

type dailyLogService struct {
	logRepo outbound.DailyLogRepository
	logger  *zap.Logger
}

func NewDailyLogService(logRepo outbound.DailyLogRepository, logger *zap.Logger) inbound.DailyLogService {
	return &dailyLogService{logRepo: logRepo, logger: logger}
}

func (s *dailyLogService) Create(ctx context.Context, pharmacyID uuid.UUID, createdBy uuid.UUID, date time.Time, title, description string) (*models.DailyLog, error) {
	d := &models.DailyLog{
		PharmacyID:  pharmacyID,
		CreatedBy:   createdBy,
		Date:        time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location()),
		Title:       title,
		Description: description,
		Status:      models.DailyLogOpen,
	}
	if err := s.logRepo.Create(ctx, d); err != nil {
		return nil, errors.ErrInternal("failed to create daily log", err)
	}
	return s.logRepo.GetByID(ctx, d.ID)
}

func (s *dailyLogService) GetByID(ctx context.Context, pharmacyID uuid.UUID, id uuid.UUID) (*models.DailyLog, error) {
	d, err := s.logRepo.GetByID(ctx, id)
	if err != nil || d == nil {
		return nil, errors.ErrNotFound("daily log")
	}
	if d.PharmacyID != pharmacyID {
		return nil, errors.ErrNotFound("daily log")
	}
	return d, nil
}

func (s *dailyLogService) ListByDate(ctx context.Context, pharmacyID uuid.UUID, date time.Time) ([]*models.DailyLog, error) {
	return s.logRepo.ListByPharmacyAndDate(ctx, pharmacyID, date)
}

func (s *dailyLogService) ListByDateRange(ctx context.Context, pharmacyID uuid.UUID, from, to time.Time) ([]*models.DailyLog, error) {
	return s.logRepo.ListByPharmacyAndDateRange(ctx, pharmacyID, from, to)
}

func (s *dailyLogService) Update(ctx context.Context, pharmacyID uuid.UUID, id uuid.UUID, title, description *string, status *models.DailyLogStatus) (*models.DailyLog, error) {
	d, err := s.logRepo.GetByID(ctx, id)
	if err != nil || d == nil {
		return nil, errors.ErrNotFound("daily log")
	}
	if d.PharmacyID != pharmacyID {
		return nil, errors.ErrNotFound("daily log")
	}
	if title != nil {
		d.Title = *title
	}
	if description != nil {
		d.Description = *description
	}
	if status != nil {
		d.Status = *status
	}
	if err := s.logRepo.Update(ctx, d); err != nil {
		return nil, errors.ErrInternal("failed to update daily log", err)
	}
	return s.logRepo.GetByID(ctx, d.ID)
}

func (s *dailyLogService) Delete(ctx context.Context, pharmacyID uuid.UUID, id uuid.UUID) error {
	d, err := s.logRepo.GetByID(ctx, id)
	if err != nil || d == nil {
		return errors.ErrNotFound("daily log")
	}
	if d.PharmacyID != pharmacyID {
		return errors.ErrNotFound("daily log")
	}
	return s.logRepo.Delete(ctx, id)
}
