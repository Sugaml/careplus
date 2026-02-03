package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type categoryRepo struct {
	db *gorm.DB
}

func NewCategoryRepository(db *gorm.DB) outbound.CategoryRepository {
	return &categoryRepo{db: db}
}

func (r *categoryRepo) Create(ctx context.Context, c *models.Category) error {
	return r.db.WithContext(ctx).Create(c).Error
}

func (r *categoryRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Category, error) {
	var c models.Category
	err := r.db.WithContext(ctx).First(&c, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *categoryRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Category, error) {
	var list []*models.Category
	err := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID).Order("sort_order ASC, name ASC").Find(&list).Error
	return list, err
}

func (r *categoryRepo) ListByParentID(ctx context.Context, pharmacyID uuid.UUID, parentID *uuid.UUID) ([]*models.Category, error) {
	var list []*models.Category
	q := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID)
	if parentID == nil {
		q = q.Where("parent_id IS NULL")
	} else {
		q = q.Where("parent_id = ?", *parentID)
	}
	err := q.Order("sort_order ASC, name ASC").Find(&list).Error
	return list, err
}

func (r *categoryRepo) Update(ctx context.Context, c *models.Category) error {
	return r.db.WithContext(ctx).Save(c).Error
}

func (r *categoryRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Category{}, "id = ?", id).Error
}
