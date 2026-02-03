package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type pharmacyConfigRepo struct {
	db *gorm.DB
}

func NewPharmacyConfigRepository(db *gorm.DB) outbound.PharmacyConfigRepository {
	return &pharmacyConfigRepo{db: db}
}

func (r *pharmacyConfigRepo) GetByPharmacyID(ctx context.Context, pharmacyID uuid.UUID) (*models.PharmacyConfig, error) {
	var c models.PharmacyConfig
	err := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID).First(&c).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *pharmacyConfigRepo) Create(ctx context.Context, c *models.PharmacyConfig) error {
	return r.db.WithContext(ctx).Create(c).Error
}

func (r *pharmacyConfigRepo) Update(ctx context.Context, c *models.PharmacyConfig) error {
	return r.db.WithContext(ctx).Save(c).Error
}
