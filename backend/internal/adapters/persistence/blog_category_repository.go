package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type blogCategoryRepo struct {
	db *gorm.DB
}

func NewBlogCategoryRepository(db *gorm.DB) outbound.BlogCategoryRepository {
	return &blogCategoryRepo{db: db}
}

func (r *blogCategoryRepo) Create(ctx context.Context, c *models.BlogCategory) error {
	return r.db.WithContext(ctx).Create(c).Error
}

func (r *blogCategoryRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.BlogCategory, error) {
	var cat models.BlogCategory
	err := r.db.WithContext(ctx).First(&cat, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &cat, nil
}

func (r *blogCategoryRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, parentID *uuid.UUID) ([]*models.BlogCategory, error) {
	var list []*models.BlogCategory
	q := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID)
	if parentID == nil {
		q = q.Where("parent_id IS NULL")
	} else {
		q = q.Where("parent_id = ?", *parentID)
	}
	err := q.Order("sort_order ASC, name ASC").Find(&list).Error
	return list, err
}

func (r *blogCategoryRepo) Update(ctx context.Context, c *models.BlogCategory) error {
	return r.db.WithContext(ctx).Save(c).Error
}

func (r *blogCategoryRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.BlogCategory{}, "id = ?", id).Error
}
