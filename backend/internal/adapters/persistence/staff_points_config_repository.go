package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type staffPointsConfigRepo struct {
	db *gorm.DB
}

func NewStaffPointsConfigRepository(db *gorm.DB) outbound.StaffPointsConfigRepository {
	return &staffPointsConfigRepo{db: db}
}

func (r *staffPointsConfigRepo) GetByPharmacyID(ctx context.Context, pharmacyID uuid.UUID) (*models.StaffPointsConfig, error) {
	var c models.StaffPointsConfig
	err := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID).First(&c).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *staffPointsConfigRepo) GetOrCreateByPharmacyID(ctx context.Context, pharmacyID uuid.UUID) (*models.StaffPointsConfig, error) {
	c, err := r.GetByPharmacyID(ctx, pharmacyID)
	if err == nil {
		return c, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	c = &models.StaffPointsConfig{
		PharmacyID:            pharmacyID,
		PointsPerCurrencyUnit: 1,
		CurrencyUnitForPoints: 100,
	}
	if err := r.db.WithContext(ctx).Create(c).Error; err != nil {
		return nil, err
	}
	return c, nil
}

func (r *staffPointsConfigRepo) Update(ctx context.Context, c *models.StaffPointsConfig) error {
	return r.db.WithContext(ctx).Save(c).Error
}
