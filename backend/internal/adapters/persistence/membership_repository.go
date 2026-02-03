package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type membershipRepo struct {
	db *gorm.DB
}

func NewMembershipRepository(db *gorm.DB) outbound.MembershipRepository {
	return &membershipRepo{db: db}
}

func (r *membershipRepo) Create(ctx context.Context, m *models.Membership) error {
	return r.db.WithContext(ctx).Create(m).Error
}

func (r *membershipRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Membership, error) {
	var m models.Membership
	err := r.db.WithContext(ctx).First(&m, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *membershipRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Membership, error) {
	var list []*models.Membership
	err := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID).
		Order("sort_order ASC, name ASC").Find(&list).Error
	return list, err
}

func (r *membershipRepo) Update(ctx context.Context, m *models.Membership) error {
	return r.db.WithContext(ctx).Save(m).Error
}

func (r *membershipRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Membership{}, "id = ?", id).Error
}
