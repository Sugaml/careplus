package services

import (
	"context"
	"errors"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	pkgerrors "github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type promoService struct {
	repo   outbound.PromoRepository
	logger *zap.Logger
}

func NewPromoService(repo outbound.PromoRepository, logger *zap.Logger) inbound.PromoService {
	return &promoService{repo: repo, logger: logger}
}

func (s *promoService) Create(ctx context.Context, pharmacyID uuid.UUID, p *models.Promo) (*models.Promo, error) {
	if p.Type == "" {
		p.Type = models.PromoTypeAnnouncement
	}
	p.PharmacyID = pharmacyID
	if err := s.repo.Create(ctx, p); err != nil {
		s.logger.Warn("promo create failed", zap.Error(err))
		return nil, err
	}
	return p, nil
}

func (s *promoService) GetByID(ctx context.Context, id uuid.UUID) (*models.Promo, error) {
	p, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, pkgerrors.ErrNotFound("promo")
		}
		return nil, err
	}
	return p, nil
}

func (s *promoService) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, types []string, activeOnly bool) ([]*models.Promo, error) {
	return s.repo.ListByPharmacy(ctx, pharmacyID, types, activeOnly)
}

func (s *promoService) Update(ctx context.Context, pharmacyID uuid.UUID, p *models.Promo) (*models.Promo, error) {
	existing, err := s.repo.GetByID(ctx, p.ID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, pkgerrors.ErrNotFound("promo")
		}
		return nil, err
	}
	if existing.PharmacyID != pharmacyID {
		return nil, pkgerrors.ErrNotFound("promo")
	}
	p.PharmacyID = pharmacyID
	if err := s.repo.Update(ctx, p); err != nil {
		s.logger.Warn("promo update failed", zap.Error(err))
		return nil, err
	}
	return p, nil
}

func (s *promoService) Delete(ctx context.Context, pharmacyID, id uuid.UUID) error {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return pkgerrors.ErrNotFound("promo")
		}
		return err
	}
	if existing.PharmacyID != pharmacyID {
		return pkgerrors.ErrNotFound("promo")
	}
	return s.repo.Delete(ctx, id)
}
