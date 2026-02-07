package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type blogPostMediaRepo struct {
	db *gorm.DB
}

func NewBlogPostMediaRepository(db *gorm.DB) outbound.BlogPostMediaRepository {
	return &blogPostMediaRepo{db: db}
}

func (r *blogPostMediaRepo) Create(ctx context.Context, m *models.BlogPostMedia) error {
	return r.db.WithContext(ctx).Create(m).Error
}

func (r *blogPostMediaRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.BlogPostMedia, error) {
	var m models.BlogPostMedia
	err := r.db.WithContext(ctx).First(&m, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *blogPostMediaRepo) ListByPostID(ctx context.Context, postID uuid.UUID) ([]*models.BlogPostMedia, error) {
	var list []*models.BlogPostMedia
	err := r.db.WithContext(ctx).Where("post_id = ?", postID).Order("sort_order ASC, created_at ASC").Find(&list).Error
	return list, err
}

func (r *blogPostMediaRepo) Update(ctx context.Context, m *models.BlogPostMedia) error {
	return r.db.WithContext(ctx).Save(m).Error
}

func (r *blogPostMediaRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.BlogPostMedia{}, "id = ?", id).Error
}

func (r *blogPostMediaRepo) DeleteByPostID(ctx context.Context, postID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("post_id = ?", postID).Delete(&models.BlogPostMedia{}).Error
}
