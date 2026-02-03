package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type customerRepo struct {
	db *gorm.DB
}

func NewCustomerRepository(db *gorm.DB) outbound.CustomerRepository {
	return &customerRepo{db: db}
}

func (r *customerRepo) Create(ctx context.Context, c *models.Customer) error {
	return r.db.WithContext(ctx).Create(c).Error
}

func (r *customerRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Customer, error) {
	var c models.Customer
	err := r.db.WithContext(ctx).First(&c, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *customerRepo) GetByPharmacyAndPhone(ctx context.Context, pharmacyID uuid.UUID, phone string) (*models.Customer, error) {
	var c models.Customer
	err := r.db.WithContext(ctx).Where("pharmacy_id = ? AND phone = ?", pharmacyID, phone).First(&c).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *customerRepo) GetByPharmacyAndReferralCode(ctx context.Context, pharmacyID uuid.UUID, code string) (*models.Customer, error) {
	var c models.Customer
	err := r.db.WithContext(ctx).Where("pharmacy_id = ? AND referral_code = ?", pharmacyID, code).First(&c).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *customerRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, limit, offset int) ([]*models.Customer, int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&models.Customer{}).Where("pharmacy_id = ?", pharmacyID).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []*models.Customer
	q := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID).Order("created_at DESC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	if offset > 0 {
		q = q.Offset(offset)
	}
	err := q.Find(&list).Error
	return list, total, err
}

func (r *customerRepo) Update(ctx context.Context, c *models.Customer) error {
	return r.db.WithContext(ctx).Save(c).Error
}
