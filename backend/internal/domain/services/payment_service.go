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

type paymentService struct {
	repo   outbound.PaymentRepository
	logger *zap.Logger
}

func NewPaymentService(repo outbound.PaymentRepository, logger *zap.Logger) inbound.PaymentService {
	return &paymentService{repo: repo, logger: logger}
}

func (s *paymentService) Create(ctx context.Context, p *models.Payment) error {
	if p.Amount <= 0 {
		return errors.ErrValidation("amount must be positive")
	}
	if p.Currency == "" {
		p.Currency = "NPR"
	}
	p.Status = models.PaymentStatusPending
	return s.repo.Create(ctx, p)
}

func (s *paymentService) GetByID(ctx context.Context, id uuid.UUID) (*models.Payment, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *paymentService) ListByOrder(ctx context.Context, orderID uuid.UUID) ([]*models.Payment, error) {
	return s.repo.ListByOrderID(ctx, orderID)
}

func (s *paymentService) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Payment, error) {
	return s.repo.ListByPharmacy(ctx, pharmacyID)
}

func (s *paymentService) Complete(ctx context.Context, paymentID uuid.UUID) error {
	p, err := s.repo.GetByID(ctx, paymentID)
	if err != nil || p == nil {
		return errors.ErrNotFound("payment")
	}
	if p.Status == models.PaymentStatusCompleted {
		return errors.ErrConflict("payment already completed")
	}
	now := time.Now()
	p.Status = models.PaymentStatusCompleted
	p.PaidAt = &now
	return s.repo.Update(ctx, p)
}
