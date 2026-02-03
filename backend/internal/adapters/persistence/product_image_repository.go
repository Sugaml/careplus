package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type productImageRepo struct {
	db *gorm.DB
}

func NewProductImageRepository(db *gorm.DB) outbound.ProductImageRepository {
	return &productImageRepo{db: db}
}

func (r *productImageRepo) Create(ctx context.Context, img *models.ProductImage) error {
	return r.db.WithContext(ctx).Create(img).Error
}

func (r *productImageRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.ProductImage, error) {
	var img models.ProductImage
	err := r.db.WithContext(ctx).First(&img, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &img, nil
}

func (r *productImageRepo) ListByProductID(ctx context.Context, productID uuid.UUID) ([]*models.ProductImage, error) {
	var list []*models.ProductImage
	err := r.db.WithContext(ctx).Where("product_id = ?", productID).Order("sort_order ASC, created_at ASC").Find(&list).Error
	return list, err
}

func (r *productImageRepo) Update(ctx context.Context, img *models.ProductImage) error {
	return r.db.WithContext(ctx).Save(img).Error
}

func (r *productImageRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.ProductImage{}, "id = ?", id).Error
}
