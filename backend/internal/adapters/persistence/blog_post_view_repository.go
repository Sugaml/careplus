package persistence

import (
	"context"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type blogPostViewRepo struct {
	db *gorm.DB
}

func NewBlogPostViewRepository(db *gorm.DB) outbound.BlogPostViewRepository {
	return &blogPostViewRepo{db: db}
}

func (r *blogPostViewRepo) Create(ctx context.Context, v *models.BlogPostView) error {
	return r.db.WithContext(ctx).Create(v).Error
}

func (r *blogPostViewRepo) CountByPostID(ctx context.Context, postID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.BlogPostView{}).Where("post_id = ?", postID).Count(&count).Error
	return count, err
}

func (r *blogPostViewRepo) CountByPostIDSince(ctx context.Context, postID uuid.UUID, since time.Time) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.BlogPostView{}).Where("post_id = ? AND viewed_at >= ?", postID, since).Count(&count).Error
	return count, err
}
