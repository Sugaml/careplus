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

type membershipService struct {
	repo   outbound.MembershipRepository
	logger *zap.Logger
}

func NewMembershipService(repo outbound.MembershipRepository, logger *zap.Logger) inbound.MembershipService {
	return &membershipService{repo: repo, logger: logger}
}

func (s *membershipService) Create(ctx context.Context, m *models.Membership) error {
	if m.Name == "" {
		return errors.ErrValidation("membership name is required")
	}
	if m.DiscountPercent < 0 || m.DiscountPercent > 100 {
		return errors.ErrValidation("discount percent must be between 0 and 100")
	}
	return s.repo.Create(ctx, m)
}

func (s *membershipService) GetByID(ctx context.Context, id uuid.UUID) (*models.Membership, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *membershipService) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Membership, error) {
	return s.repo.ListByPharmacy(ctx, pharmacyID)
}

func (s *membershipService) Update(ctx context.Context, m *models.Membership) error {
	if m.ID == uuid.Nil {
		return errors.ErrValidation("membership ID is required")
	}
	if m.Name == "" {
		return errors.ErrValidation("membership name is required")
	}
	if m.DiscountPercent < 0 || m.DiscountPercent > 100 {
		return errors.ErrValidation("discount percent must be between 0 and 100")
	}
	return s.repo.Update(ctx, m)
}

func (s *membershipService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}
