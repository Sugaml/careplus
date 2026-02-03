package services

import (
	"context"
	"strings"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type promoCodeService struct {
	repo      outbound.PromoCodeRepository
	orderRepo outbound.OrderRepository
	logger    *zap.Logger
}

func NewPromoCodeService(repo outbound.PromoCodeRepository, orderRepo outbound.OrderRepository, logger *zap.Logger) inbound.PromoCodeService {
	return &promoCodeService{repo: repo, orderRepo: orderRepo, logger: logger}
}

func (s *promoCodeService) Validate(ctx context.Context, pharmacyID uuid.UUID, code string, subTotal float64, userID *uuid.UUID) (*inbound.PromoCodeValidateResult, error) {
	code = strings.TrimSpace(strings.ToUpper(code))
	if code == "" {
		return nil, errors.ErrValidation("promo code is required")
	}
	p, err := s.repo.GetByPharmacyAndCode(ctx, pharmacyID, code)
	if err != nil || p == nil {
		return nil, errors.ErrNotFound("promo code not found or invalid")
	}
	if !p.IsActive {
		return nil, errors.ErrValidation("promo code is not active")
	}
	now := time.Now()
	if now.Before(p.ValidFrom) {
		return nil, errors.ErrValidation("promo code is not yet valid")
	}
	if now.After(p.ValidUntil) {
		return nil, errors.ErrValidation("promo code has expired")
	}
	if p.MaxUses > 0 && p.UsedCount >= p.MaxUses {
		return nil, errors.ErrValidation("promo code has reached maximum uses")
	}
	if p.FirstOrderOnly {
		if userID == nil {
			return nil, errors.ErrValidation("this code is for first order only; please log in")
		}
		count, _ := s.orderRepo.CountByCreatedByAndPharmacy(ctx, *userID, pharmacyID)
		if count > 0 {
			return nil, errors.ErrValidation("this code is for first order only")
		}
	}
	if p.MinOrderAmount > 0 && subTotal < p.MinOrderAmount {
		return nil, errors.ErrValidation("order subtotal is below minimum for this promo")
	}
	discount := s.computeDiscount(p, subTotal)
	if discount <= 0 {
		return nil, errors.ErrValidation("promo does not apply to this order")
	}
	if discount > subTotal {
		discount = subTotal
	}
	return &inbound.PromoCodeValidateResult{
		Code:           p.Code,
		DiscountAmount: discount,
		PromoCodeID:    p.ID,
	}, nil
}

func (s *promoCodeService) computeDiscount(p *models.PromoCode, subTotal float64) float64 {
	switch p.DiscountType {
	case models.DiscountTypePercent:
		return subTotal * (p.DiscountValue / 100)
	case models.DiscountTypeFixed:
		if p.DiscountValue > subTotal {
			return subTotal
		}
		return p.DiscountValue
	default:
		return 0
	}
}

func (s *promoCodeService) Create(ctx context.Context, pharmacyID uuid.UUID, p *models.PromoCode) (*models.PromoCode, error) {
	p.PharmacyID = pharmacyID
	p.Code = strings.TrimSpace(strings.ToUpper(p.Code))
	if p.Code == "" {
		return nil, errors.ErrValidation("code is required")
	}
	if p.DiscountValue <= 0 {
		return nil, errors.ErrValidation("discount value must be positive")
	}
	if p.DiscountType != models.DiscountTypePercent && p.DiscountType != models.DiscountTypeFixed {
		return nil, errors.ErrValidation("discount type must be percent or fixed")
	}
	if p.ValidUntil.Before(p.ValidFrom) {
		return nil, errors.ErrValidation("valid_until must be after valid_from")
	}
	existing, _ := s.repo.GetByPharmacyAndCode(ctx, pharmacyID, p.Code)
	if existing != nil {
		return nil, errors.ErrConflict("promo code already exists for this pharmacy")
	}
	if err := s.repo.Create(ctx, p); err != nil {
		return nil, errors.ErrInternal("failed to create promo code", err)
	}
	return p, nil
}

func (s *promoCodeService) GetByID(ctx context.Context, id uuid.UUID) (*models.PromoCode, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *promoCodeService) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.PromoCode, error) {
	return s.repo.ListByPharmacy(ctx, pharmacyID)
}

func (s *promoCodeService) Update(ctx context.Context, pharmacyID uuid.UUID, p *models.PromoCode) (*models.PromoCode, error) {
	existing, err := s.repo.GetByID(ctx, p.ID)
	if err != nil || existing == nil {
		return nil, errors.ErrNotFound("promo code")
	}
	if existing.PharmacyID != pharmacyID {
		return nil, errors.ErrForbidden("promo code does not belong to this pharmacy")
	}
	p.PharmacyID = pharmacyID
	p.Code = strings.TrimSpace(strings.ToUpper(p.Code))
	p.UsedCount = existing.UsedCount
	if err := s.repo.Update(ctx, p); err != nil {
		return nil, errors.ErrInternal("failed to update promo code", err)
	}
	return p, nil
}
