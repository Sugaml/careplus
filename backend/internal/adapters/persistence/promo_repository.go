package persistence

import (
	"context"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type promoRepo struct {
	db *gorm.DB
}

func NewPromoRepository(db *gorm.DB) outbound.PromoRepository {
	return &promoRepo{db: db}
}

func (r *promoRepo) Create(ctx context.Context, p *models.Promo) error {
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *promoRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Promo, error) {
	var p models.Promo
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *promoRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, types []string, activeOnly bool) ([]*models.Promo, error) {
	now := time.Now()
	q := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID)
	if len(types) > 0 {
		q = q.Where("type IN ?", types)
	}
	if activeOnly {
		q = q.Where("is_active = ?", true).
			Where("(start_at IS NULL OR start_at <= ?)", now).
			Where("(end_at IS NULL OR end_at >= ?)", now)
	}
	q = q.Order("sort_order ASC, created_at DESC")
	var list []*models.Promo
	err := q.Find(&list).Error
	return list, err
}

func (r *promoRepo) Update(ctx context.Context, p *models.Promo) error {
	return r.db.WithContext(ctx).Save(p).Error
}

func (r *promoRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Promo{}, "id = ?", id).Error
}
