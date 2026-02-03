package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type reviewCommentRepo struct {
	db *gorm.DB
}

func NewReviewCommentRepository(db *gorm.DB) outbound.ReviewCommentRepository {
	return &reviewCommentRepo{db: db}
}

func (r *reviewCommentRepo) Create(ctx context.Context, c *models.ReviewComment) error {
	return r.db.WithContext(ctx).Create(c).Error
}

func (r *reviewCommentRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.ReviewComment, error) {
	var c models.ReviewComment
	err := r.db.WithContext(ctx).First(&c, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *reviewCommentRepo) ListByReviewID(ctx context.Context, reviewID uuid.UUID, limit, offset int) ([]*models.ReviewComment, error) {
	var list []*models.ReviewComment
	q := r.db.WithContext(ctx).Where("review_id = ?", reviewID).Order("created_at ASC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if offset > 0 {
		q = q.Offset(offset)
	}
	err := q.Preload("User").Find(&list).Error
	return list, err
}

func (r *reviewCommentRepo) CountByReviewID(ctx context.Context, reviewID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ReviewComment{}).Where("review_id = ?", reviewID).Count(&count).Error
	return count, err
}

func (r *reviewCommentRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.ReviewComment{}, "id = ?", id).Error
}
