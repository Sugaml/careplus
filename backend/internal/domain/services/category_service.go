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

type categoryService struct {
	repo   outbound.CategoryRepository
	logger *zap.Logger
}

func NewCategoryService(repo outbound.CategoryRepository, logger *zap.Logger) inbound.CategoryService {
	return &categoryService{repo: repo, logger: logger}
}

func (s *categoryService) Create(ctx context.Context, c *models.Category) error {
	if c.Name == "" {
		return errors.ErrValidation("category name is required")
	}
	return s.repo.Create(ctx, c)
}

func (s *categoryService) GetByID(ctx context.Context, id uuid.UUID) (*models.Category, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *categoryService) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Category, error) {
	return s.repo.ListByPharmacy(ctx, pharmacyID)
}

func (s *categoryService) ListByParentID(ctx context.Context, pharmacyID uuid.UUID, parentID *uuid.UUID) ([]*models.Category, error) {
	return s.repo.ListByParentID(ctx, pharmacyID, parentID)
}

func (s *categoryService) Update(ctx context.Context, c *models.Category) error {
	if c.ID == uuid.Nil {
		return errors.ErrValidation("category ID is required")
	}
	if c.Name == "" {
		return errors.ErrValidation("category name is required")
	}
	return s.repo.Update(ctx, c)
}

func (s *categoryService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}
