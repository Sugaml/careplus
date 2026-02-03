package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type invoiceRepo struct {
	db *gorm.DB
}

func NewInvoiceRepository(db *gorm.DB) outbound.InvoiceRepository {
	return &invoiceRepo{db: db}
}

func (r *invoiceRepo) Create(ctx context.Context, inv *models.Invoice) error {
	return r.db.WithContext(ctx).Create(inv).Error
}

func (r *invoiceRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Invoice, error) {
	var inv models.Invoice
	err := r.db.WithContext(ctx).First(&inv, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (r *invoiceRepo) GetByOrderID(ctx context.Context, orderID uuid.UUID) (*models.Invoice, error) {
	var inv models.Invoice
	err := r.db.WithContext(ctx).Where("order_id = ?", orderID).First(&inv).Error
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (r *invoiceRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Invoice, error) {
	var list []*models.Invoice
	err := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID).Order("created_at DESC").Find(&list).Error
	return list, err
}

func (r *invoiceRepo) Update(ctx context.Context, inv *models.Invoice) error {
	return r.db.WithContext(ctx).Save(inv).Error
}
