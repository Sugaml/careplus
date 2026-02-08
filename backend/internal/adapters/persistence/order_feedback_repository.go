package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type orderFeedbackRepo struct {
	db *gorm.DB
}

func NewOrderFeedbackRepository(db *gorm.DB) outbound.OrderFeedbackRepository {
	return &orderFeedbackRepo{db: db}
}

func (r *orderFeedbackRepo) Create(ctx context.Context, f *models.OrderFeedback) error {
	return r.db.WithContext(ctx).Create(f).Error
}

func (r *orderFeedbackRepo) GetByOrderID(ctx context.Context, orderID uuid.UUID) (*models.OrderFeedback, error) {
	var f models.OrderFeedback
	err := r.db.WithContext(ctx).Where("order_id = ?", orderID).Preload("User").First(&f).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &f, nil
}
