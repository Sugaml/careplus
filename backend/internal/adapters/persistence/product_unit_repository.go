package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type productUnitRepo struct {
	db *gorm.DB
}

func NewProductUnitRepository(db *gorm.DB) outbound.ProductUnitRepository {
	return &productUnitRepo{db: db}
}

func (r *productUnitRepo) Create(ctx context.Context, u *models.ProductUnit) error {
	return r.db.WithContext(ctx).Create(u).Error
}

func (r *productUnitRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.ProductUnit, error) {
	var u models.ProductUnit
	err := r.db.WithContext(ctx).First(&u, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *productUnitRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.ProductUnit, error) {
	var list []*models.ProductUnit
	err := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID).Order("sort_order ASC, name ASC").Find(&list).Error
	return list, err
}

func (r *productUnitRepo) Update(ctx context.Context, u *models.ProductUnit) error {
	return r.db.WithContext(ctx).Save(u).Error
}

func (r *productUnitRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.ProductUnit{}, "id = ?", id).Error
}
