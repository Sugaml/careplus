package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type paymentGatewayRepository struct {
	db *gorm.DB
}

func NewPaymentGatewayRepository(db *gorm.DB) outbound.PaymentGatewayRepository {
	return &paymentGatewayRepository{db: db}
}

func (r *paymentGatewayRepository) Create(ctx context.Context, pg *models.PaymentGateway) error {
	return r.db.WithContext(ctx).Create(pg).Error
}

func (r *paymentGatewayRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.PaymentGateway, error) {
	var pg models.PaymentGateway
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&pg).Error
	if err != nil {
		return nil, err
	}
	return &pg, nil
}

func (r *paymentGatewayRepository) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, activeOnly bool) ([]*models.PaymentGateway, error) {
	var list []*models.PaymentGateway
	q := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID)
	if activeOnly {
		q = q.Where("is_active = ?", true)
	}
	err := q.Order("sort_order ASC, name ASC").Find(&list).Error
	return list, err
}

func (r *paymentGatewayRepository) Update(ctx context.Context, pg *models.PaymentGateway) error {
	return r.db.WithContext(ctx).Save(pg).Error
}

func (r *paymentGatewayRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.PaymentGateway{}, "id = ?", id).Error
}
