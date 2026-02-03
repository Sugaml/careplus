package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type pointsTransactionRepo struct {
	db *gorm.DB
}

func NewPointsTransactionRepository(db *gorm.DB) outbound.PointsTransactionRepository {
	return &pointsTransactionRepo{db: db}
}

func (r *pointsTransactionRepo) Create(ctx context.Context, p *models.PointsTransaction) error {
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *pointsTransactionRepo) ListByCustomer(ctx context.Context, customerID uuid.UUID, limit, offset int) ([]*models.PointsTransaction, error) {
	var list []*models.PointsTransaction
	q := r.db.WithContext(ctx).Where("customer_id = ?", customerID).Order("created_at DESC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if offset > 0 {
		q = q.Offset(offset)
	}
	err := q.Find(&list).Error
	return list, err
}
