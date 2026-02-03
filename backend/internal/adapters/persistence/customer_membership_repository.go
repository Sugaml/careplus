package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type customerMembershipRepo struct {
	db *gorm.DB
}

func NewCustomerMembershipRepository(db *gorm.DB) outbound.CustomerMembershipRepository {
	return &customerMembershipRepo{db: db}
}

func (r *customerMembershipRepo) Create(ctx context.Context, cm *models.CustomerMembership) error {
	return r.db.WithContext(ctx).Create(cm).Error
}

func (r *customerMembershipRepo) GetByCustomerID(ctx context.Context, customerID uuid.UUID) (*models.CustomerMembership, error) {
	var cm models.CustomerMembership
	err := r.db.WithContext(ctx).Where("customer_id = ?", customerID).Preload("Membership").First(&cm).Error
	if err != nil {
		return nil, err
	}
	return &cm, nil
}

func (r *customerMembershipRepo) Update(ctx context.Context, cm *models.CustomerMembership) error {
	return r.db.WithContext(ctx).Save(cm).Error
}

func (r *customerMembershipRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.CustomerMembership{}, "id = ?", id).Error
}
