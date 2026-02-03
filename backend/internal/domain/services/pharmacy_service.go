package services

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type pharmacyService struct {
	repo   outbound.PharmacyRepository
	logger *zap.Logger
}

func NewPharmacyService(repo outbound.PharmacyRepository, logger *zap.Logger) inbound.PharmacyService {
	return &pharmacyService{repo: repo, logger: logger}
}

func (s *pharmacyService) Create(ctx context.Context, p *models.Pharmacy) error {
	if p.Name == "" {
		return errors.ErrValidation("pharmacy name is required")
	}
	if p.LicenseNo == "" {
		return errors.ErrValidation("license number is required")
	}
	return s.repo.Create(ctx, p)
}

func (s *pharmacyService) GetByID(ctx context.Context, id uuid.UUID) (*models.Pharmacy, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *pharmacyService) Update(ctx context.Context, p *models.Pharmacy) error {
	if p.ID == uuid.Nil {
		return errors.ErrValidation("pharmacy ID is required")
	}
	return s.repo.Update(ctx, p)
}

func (s *pharmacyService) List(ctx context.Context) ([]*models.Pharmacy, error) {
	return s.repo.List(ctx)
}
