package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type productReviewRepo struct {
	db *gorm.DB
}

func NewProductReviewRepository(db *gorm.DB) outbound.ProductReviewRepository {
	return &productReviewRepo{db: db}
}

func (r *productReviewRepo) Create(ctx context.Context, rev *models.ProductReview) error {
	return r.db.WithContext(ctx).Create(rev).Error
}

func (r *productReviewRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.ProductReview, error) {
	var rev models.ProductReview
	err := r.db.WithContext(ctx).Preload("User").First(&rev, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &rev, nil
}

func (r *productReviewRepo) ListByProductID(ctx context.Context, productID uuid.UUID, limit, offset int) ([]*models.ProductReview, error) {
	var list []*models.ProductReview
	q := r.db.WithContext(ctx).Where("product_id = ?", productID).Order("created_at DESC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if offset > 0 {
		q = q.Offset(offset)
	}
	err := q.Preload("User").Find(&list).Error
	return list, err
}

func (r *productReviewRepo) Update(ctx context.Context, rev *models.ProductReview) error {
	return r.db.WithContext(ctx).Save(rev).Error
}

func (r *productReviewRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.ProductReview{}, "id = ?", id).Error
}

func (r *productReviewRepo) ExistsByProductAndUser(ctx context.Context, productID, userID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.ProductReview{}).Where("product_id = ? AND user_id = ?", productID, userID).Count(&count).Error
	return count > 0, err
}

func (r *productReviewRepo) GetRatingStatsByProductIDs(ctx context.Context, productIDs []uuid.UUID) (map[uuid.UUID]outbound.RatingStats, error) {
	if len(productIDs) == 0 {
		return nil, nil
	}
	type row struct {
		ProductID uuid.UUID
		Avg       float64
		Count     int64
	}
	var rows []row
	err := r.db.WithContext(ctx).Model(&models.ProductReview{}).
		Select("product_id, COALESCE(AVG(rating), 0) as avg, COUNT(*) as count").
		Where("product_id IN ?", productIDs).
		Group("product_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]outbound.RatingStats, len(rows))
	for _, x := range rows {
		out[x.ProductID] = outbound.RatingStats{Avg: x.Avg, Count: int(x.Count)}
	}
	return out, nil
}
