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

type paymentGatewayService struct {
	repo   outbound.PaymentGatewayRepository
	logger *zap.Logger
}

func NewPaymentGatewayService(repo outbound.PaymentGatewayRepository, logger *zap.Logger) inbound.PaymentGatewayService {
	return &paymentGatewayService{repo: repo, logger: logger}
}

func (s *paymentGatewayService) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, activeOnly bool) ([]*models.PaymentGateway, error) {
	return s.repo.ListByPharmacy(ctx, pharmacyID, activeOnly)
}

func (s *paymentGatewayService) GetByID(ctx context.Context, id uuid.UUID) (*models.PaymentGateway, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *paymentGatewayService) Create(ctx context.Context, pharmacyID uuid.UUID, pg *models.PaymentGateway) (*models.PaymentGateway, error) {
	if pg.Code == "" {
		return nil, errors.ErrValidation("code is required")
	}
	if pg.Name == "" {
		return nil, errors.ErrValidation("name is required")
	}
	pg.PharmacyID = pharmacyID
	if err := s.repo.Create(ctx, pg); err != nil {
		return nil, errors.ErrInternal("failed to create payment gateway", err)
	}
	return pg, nil
}

func (s *paymentGatewayService) Update(ctx context.Context, pharmacyID uuid.UUID, pg *models.PaymentGateway) (*models.PaymentGateway, error) {
	existing, err := s.repo.GetByID(ctx, pg.ID)
	if err != nil || existing == nil {
		return nil, errors.ErrNotFound("payment gateway")
	}
	if existing.PharmacyID != pharmacyID {
		return nil, errors.ErrForbidden("payment gateway does not belong to this pharmacy")
	}
	if pg.Code != "" {
		existing.Code = pg.Code
	}
	if pg.Name != "" {
		existing.Name = pg.Name
	}
	existing.IsActive = pg.IsActive
	existing.SortOrder = pg.SortOrder
	existing.QrDetails = pg.QrDetails
	existing.BankDetails = pg.BankDetails
	existing.QrImageURL = pg.QrImageURL
	existing.ClientID = pg.ClientID
	existing.SecretKey = pg.SecretKey
	existing.ExtraConfig = pg.ExtraConfig
	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, errors.ErrInternal("failed to update payment gateway", err)
	}
	return existing, nil
}

func (s *paymentGatewayService) Delete(ctx context.Context, pharmacyID, id uuid.UUID) error {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil || existing == nil {
		return errors.ErrNotFound("payment gateway")
	}
	if existing.PharmacyID != pharmacyID {
		return errors.ErrForbidden("payment gateway does not belong to this pharmacy")
	}
	return s.repo.Delete(ctx, id)
}
