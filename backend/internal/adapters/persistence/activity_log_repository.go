package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type activityLogRepo struct {
	db *gorm.DB
}

func NewActivityLogRepository(db *gorm.DB) outbound.ActivityLogRepository {
	return &activityLogRepo{db: db}
}

func (r *activityLogRepo) Create(ctx context.Context, a *models.ActivityLog) error {
	return r.db.WithContext(ctx).Create(a).Error
}

func (r *activityLogRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, limit, offset int) ([]*models.ActivityLog, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	var list []*models.ActivityLog
	err := r.db.WithContext(ctx).
		Where("pharmacy_id = ?", pharmacyID).
		Preload("User").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&list).Error
	return list, err
}
