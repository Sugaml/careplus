package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type orderReturnRequestRepo struct {
	db *gorm.DB
}

func NewOrderReturnRequestRepository(db *gorm.DB) outbound.OrderReturnRequestRepository {
	return &orderReturnRequestRepo{db: db}
}

func (r *orderReturnRequestRepo) Create(ctx context.Context, req *models.OrderReturnRequest) error {
	return r.db.WithContext(ctx).Create(req).Error
}

func (r *orderReturnRequestRepo) GetByOrderID(ctx context.Context, orderID uuid.UUID) (*models.OrderReturnRequest, error) {
	var req models.OrderReturnRequest
	err := r.db.WithContext(ctx).Where("order_id = ?", orderID).First(&req).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &req, nil
}
