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

type invoiceService struct {
	invRepo    outbound.InvoiceRepository
	orderRepo  outbound.OrderRepository
	paymentRepo outbound.PaymentRepository
	logger     *zap.Logger
}

func NewInvoiceService(
	invRepo outbound.InvoiceRepository,
	orderRepo outbound.OrderRepository,
	paymentRepo outbound.PaymentRepository,
	logger *zap.Logger,
) inbound.InvoiceService {
	return &invoiceService{
		invRepo:     invRepo,
		orderRepo:   orderRepo,
		paymentRepo: paymentRepo,
		logger:     logger,
	}
}

func (s *invoiceService) CreateFromOrder(ctx context.Context, pharmacyID, orderID, createdBy uuid.UUID) (*models.Invoice, error) {
	order, err := s.orderRepo.GetByID(ctx, orderID)
	if err != nil || order == nil {
		return nil, errors.ErrNotFound("order")
	}
	if order.PharmacyID != pharmacyID {
		return nil, errors.ErrForbidden("order does not belong to this pharmacy")
	}
	existing, _ := s.invRepo.GetByOrderID(ctx, orderID)
	if existing != nil {
		return nil, errors.ErrConflict("invoice already exists for this order")
	}
	inv := &models.Invoice{
		PharmacyID: pharmacyID,
		OrderID:    orderID,
		Status:     models.InvoiceStatusDraft,
		CreatedBy:  createdBy,
	}
	if err := s.invRepo.Create(ctx, inv); err != nil {
		return nil, errors.ErrInternal("failed to create invoice", err)
	}
	return inv, nil
}

func (s *invoiceService) GetByID(ctx context.Context, id uuid.UUID) (*inbound.InvoiceView, error) {
	inv, err := s.invRepo.GetByID(ctx, id)
	if err != nil || inv == nil {
		return nil, errors.ErrNotFound("invoice")
	}
	order, err := s.orderRepo.GetByID(ctx, inv.OrderID)
	if err != nil || order == nil {
		return nil, errors.ErrNotFound("order")
	}
	payments, err := s.paymentRepo.ListByOrderID(ctx, inv.OrderID)
	if err != nil {
		payments = nil
	}
	return &inbound.InvoiceView{
		Invoice:  inv,
		Order:    order,
		Payments: payments,
	}, nil
}

func (s *invoiceService) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Invoice, error) {
	return s.invRepo.ListByPharmacy(ctx, pharmacyID)
}

func (s *invoiceService) Issue(ctx context.Context, invoiceID uuid.UUID) (*models.Invoice, error) {
	inv, err := s.invRepo.GetByID(ctx, invoiceID)
	if err != nil || inv == nil {
		return nil, errors.ErrNotFound("invoice")
	}
	if inv.Status == models.InvoiceStatusIssued {
		return nil, errors.ErrConflict("invoice already issued")
	}
	now := time.Now()
	inv.Status = models.InvoiceStatusIssued
	inv.IssuedAt = &now
	if err := s.invRepo.Update(ctx, inv); err != nil {
		return nil, errors.ErrInternal("failed to issue invoice", err)
	}
	return inv, nil
}
