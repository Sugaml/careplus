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

type productUnitService struct {
	repo   outbound.ProductUnitRepository
	logger *zap.Logger
}

func NewProductUnitService(repo outbound.ProductUnitRepository, logger *zap.Logger) inbound.ProductUnitService {
	return &productUnitService{repo: repo, logger: logger}
}

func (s *productUnitService) Create(ctx context.Context, u *models.ProductUnit) error {
	if u.Name == "" {
		return errors.ErrValidation("product unit name is required")
	}
	return s.repo.Create(ctx, u)
}

func (s *productUnitService) GetByID(ctx context.Context, id uuid.UUID) (*models.ProductUnit, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *productUnitService) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.ProductUnit, error) {
	return s.repo.ListByPharmacy(ctx, pharmacyID)
}

func (s *productUnitService) Update(ctx context.Context, u *models.ProductUnit) error {
	if u.ID == uuid.Nil {
		return errors.ErrValidation("product unit ID is required")
	}
	if u.Name == "" {
		return errors.ErrValidation("product unit name is required")
	}
	return s.repo.Update(ctx, u)
}

func (s *productUnitService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}
