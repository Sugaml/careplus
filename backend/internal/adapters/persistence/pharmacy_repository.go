package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type pharmacyRepo struct {
	db *gorm.DB
}

func NewPharmacyRepository(db *gorm.DB) outbound.PharmacyRepository {
	return &pharmacyRepo{db: db}
}

func (r *pharmacyRepo) Create(ctx context.Context, p *models.Pharmacy) error {
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *pharmacyRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Pharmacy, error) {
	var p models.Pharmacy
	err := r.db.WithContext(ctx).First(&p, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *pharmacyRepo) GetByHostnameSlug(ctx context.Context, hostnameSlug string) (*models.Pharmacy, error) {
	var p models.Pharmacy
	err := r.db.WithContext(ctx).Where("hostname_slug = ? AND is_active = ?", hostnameSlug, true).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *pharmacyRepo) Update(ctx context.Context, p *models.Pharmacy) error {
	return r.db.WithContext(ctx).Save(p).Error
}

func (r *pharmacyRepo) List(ctx context.Context) ([]*models.Pharmacy, error) {
	var list []*models.Pharmacy
	err := r.db.WithContext(ctx).Find(&list).Error
	return list, err
}
