package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type blogPostCommentRepo struct {
	db *gorm.DB
}

func NewBlogPostCommentRepository(db *gorm.DB) outbound.BlogPostCommentRepository {
	return &blogPostCommentRepo{db: db}
}

func (r *blogPostCommentRepo) Create(ctx context.Context, c *models.BlogPostComment) error {
	return r.db.WithContext(ctx).Create(c).Error
}

func (r *blogPostCommentRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.BlogPostComment, error) {
	var comment models.BlogPostComment
	err := r.db.WithContext(ctx).Preload("User").First(&comment, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &comment, nil
}

func (r *blogPostCommentRepo) ListByPostID(ctx context.Context, postID uuid.UUID, limit, offset int) ([]*models.BlogPostComment, error) {
	var list []*models.BlogPostComment
	q := r.db.WithContext(ctx).Where("post_id = ?", postID).Order("created_at ASC").Preload("User")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if offset > 0 {
		q = q.Offset(offset)
	}
	err := q.Find(&list).Error
	return list, err
}

func (r *blogPostCommentRepo) CountByPostID(ctx context.Context, postID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.BlogPostComment{}).Where("post_id = ?", postID).Count(&count).Error
	return count, err
}

func (r *blogPostCommentRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.BlogPostComment{}, "id = ?", id).Error
}
