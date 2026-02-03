package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type promoCodeRepo struct {
	db *gorm.DB
}

func NewPromoCodeRepository(db *gorm.DB) outbound.PromoCodeRepository {
	return &promoCodeRepo{db: db}
}

func (r *promoCodeRepo) Create(ctx context.Context, p *models.PromoCode) error {
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *promoCodeRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.PromoCode, error) {
	var p models.PromoCode
	err := r.db.WithContext(ctx).First(&p, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *promoCodeRepo) GetByPharmacyAndCode(ctx context.Context, pharmacyID uuid.UUID, code string) (*models.PromoCode, error) {
	var p models.PromoCode
	err := r.db.WithContext(ctx).Where("pharmacy_id = ? AND code = ?", pharmacyID, code).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *promoCodeRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.PromoCode, error) {
	var list []*models.PromoCode
	err := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID).Order("created_at DESC").Find(&list).Error
	return list, err
}

func (r *promoCodeRepo) Update(ctx context.Context, p *models.PromoCode) error {
	return r.db.WithContext(ctx).Save(p).Error
}

func (r *promoCodeRepo) IncrementUsedCount(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&models.PromoCode{}).Where("id = ?", id).UpdateColumn("used_count", gorm.Expr("used_count + ?", 1)).Error
}
