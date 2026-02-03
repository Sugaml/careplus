package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type reviewLikeRepo struct {
	db *gorm.DB
}

func NewReviewLikeRepository(db *gorm.DB) outbound.ReviewLikeRepository {
	return &reviewLikeRepo{db: db}
}

func (r *reviewLikeRepo) Create(ctx context.Context, l *models.ReviewLike) error {
	return r.db.WithContext(ctx).Create(l).Error
}

func (r *reviewLikeRepo) DeleteByReviewAndUser(ctx context.Context, reviewID, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("review_id = ? AND user_id = ?", reviewID, userID).Delete(&models.ReviewLike{}).Error
}

func (r *reviewLikeRepo) CountByReviewID(ctx context.Context, reviewID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ReviewLike{}).Where("review_id = ?", reviewID).Count(&count).Error
	return count, err
}

func (r *reviewLikeRepo) Exists(ctx context.Context, reviewID, userID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ReviewLike{}).Where("review_id = ? AND user_id = ?", reviewID, userID).Count(&count).Error
	return count > 0, err
}
