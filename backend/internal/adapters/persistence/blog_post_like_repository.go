package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type blogPostLikeRepo struct {
	db *gorm.DB
}

func NewBlogPostLikeRepository(db *gorm.DB) outbound.BlogPostLikeRepository {
	return &blogPostLikeRepo{db: db}
}

func (r *blogPostLikeRepo) Create(ctx context.Context, l *models.BlogPostLike) error {
	return r.db.WithContext(ctx).Create(l).Error
}

func (r *blogPostLikeRepo) DeleteByPostAndUser(ctx context.Context, postID, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("post_id = ? AND user_id = ?", postID, userID).Delete(&models.BlogPostLike{}).Error
}

func (r *blogPostLikeRepo) CountByPostID(ctx context.Context, postID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.BlogPostLike{}).Where("post_id = ?", postID).Count(&count).Error
	return count, err
}

func (r *blogPostLikeRepo) Exists(ctx context.Context, postID, userID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.BlogPostLike{}).Where("post_id = ? AND user_id = ?", postID, userID).Count(&count).Error
	return count > 0, err
}
