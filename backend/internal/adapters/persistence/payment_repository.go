package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type paymentRepo struct {
	db *gorm.DB
}

func NewPaymentRepository(db *gorm.DB) outbound.PaymentRepository {
	return &paymentRepo{db: db}
}

func (r *paymentRepo) Create(ctx context.Context, p *models.Payment) error {
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *paymentRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Payment, error) {
	var p models.Payment
	err := r.db.WithContext(ctx).First(&p, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *paymentRepo) ListByOrderID(ctx context.Context, orderID uuid.UUID) ([]*models.Payment, error) {
	var list []*models.Payment
	err := r.db.WithContext(ctx).Where("order_id = ?", orderID).Find(&list).Error
	return list, err
}

func (r *paymentRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Payment, error) {
	var list []*models.Payment
	err := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID).Order("created_at DESC").Find(&list).Error
	return list, err
}

func (r *paymentRepo) Update(ctx context.Context, p *models.Payment) error {
	return r.db.WithContext(ctx).Save(p).Error
}
