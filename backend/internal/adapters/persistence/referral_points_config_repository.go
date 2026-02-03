package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type referralPointsConfigRepo struct {
	db *gorm.DB
}

func NewReferralPointsConfigRepository(db *gorm.DB) outbound.ReferralPointsConfigRepository {
	return &referralPointsConfigRepo{db: db}
}

func (r *referralPointsConfigRepo) Create(ctx context.Context, c *models.ReferralPointsConfig) error {
	return r.db.WithContext(ctx).Create(c).Error
}

func (r *referralPointsConfigRepo) GetByPharmacyID(ctx context.Context, pharmacyID uuid.UUID) (*models.ReferralPointsConfig, error) {
	var c models.ReferralPointsConfig
	err := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID).First(&c).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *referralPointsConfigRepo) Update(ctx context.Context, c *models.ReferralPointsConfig) error {
	return r.db.WithContext(ctx).Save(c).Error
}
