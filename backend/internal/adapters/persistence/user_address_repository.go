package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type userAddressRepo struct {
	db *gorm.DB
}

func NewUserAddressRepository(db *gorm.DB) outbound.UserAddressRepository {
	return &userAddressRepo{db: db}
}

func (r *userAddressRepo) Create(ctx context.Context, a *models.UserAddress) error {
	return r.db.WithContext(ctx).Create(a).Error
}

func (r *userAddressRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.UserAddress, error) {
	var a models.UserAddress
	err := r.db.WithContext(ctx).First(&a, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *userAddressRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*models.UserAddress, error) {
	var list []*models.UserAddress
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).Order("is_default DESC, created_at ASC").Find(&list).Error
	return list, err
}

func (r *userAddressRepo) Update(ctx context.Context, a *models.UserAddress) error {
	return r.db.WithContext(ctx).Save(a).Error
}

func (r *userAddressRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.UserAddress{}, "id = ?", id).Error
}

func (r *userAddressRepo) ClearDefaultByUserID(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&models.UserAddress{}).Where("user_id = ?", userID).Update("is_default", false).Error
}
