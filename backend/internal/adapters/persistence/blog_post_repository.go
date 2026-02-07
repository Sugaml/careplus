package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type blogPostRepo struct {
	db *gorm.DB
}

func NewBlogPostRepository(db *gorm.DB) outbound.BlogPostRepository {
	return &blogPostRepo{db: db}
}

func (r *blogPostRepo) Create(ctx context.Context, p *models.BlogPost) error {
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *blogPostRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.BlogPost, error) {
	var post models.BlogPost
	err := r.db.WithContext(ctx).Preload("Author").Preload("Category").Preload("Pharmacy").
		First(&post, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &post, nil
}

func (r *blogPostRepo) GetByPharmacyAndSlug(ctx context.Context, pharmacyID uuid.UUID, slug string) (*models.BlogPost, error) {
	var post models.BlogPost
	err := r.db.WithContext(ctx).Where("pharmacy_id = ? AND slug = ?", pharmacyID, slug).
		Preload("Author").Preload("Category").First(&post).Error
	if err != nil {
		return nil, err
	}
	return &post, nil
}

func (r *blogPostRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, status *string, categoryID *uuid.UUID, limit, offset int) ([]*models.BlogPost, int64, error) {
	var list []*models.BlogPost
	q := r.db.WithContext(ctx).Model(&models.BlogPost{}).Where("pharmacy_id = ?", pharmacyID)
	if status != nil && *status != "" {
		q = q.Where("status = ?", *status)
	}
	if categoryID != nil {
		q = q.Where("category_id = ?", *categoryID)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	q = r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID)
	if status != nil && *status != "" {
		q = q.Where("status = ?", *status)
	}
	if categoryID != nil {
		q = q.Where("category_id = ?", *categoryID)
	}
	q = q.Order("created_at DESC").Preload("Author").Preload("Category")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if offset > 0 {
		q = q.Offset(offset)
	}
	err := q.Find(&list).Error
	return list, total, err
}

func (r *blogPostRepo) ListPendingByPharmacy(ctx context.Context, pharmacyID uuid.UUID, limit, offset int) ([]*models.BlogPost, int64, error) {
	status := models.BlogPostStatusPendingApproval
	return r.ListByPharmacy(ctx, pharmacyID, &status, nil, limit, offset)
}

func (r *blogPostRepo) Update(ctx context.Context, p *models.BlogPost) error {
	return r.db.WithContext(ctx).Save(p).Error
}

func (r *blogPostRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.BlogPost{}, "id = ?", id).Error
}
