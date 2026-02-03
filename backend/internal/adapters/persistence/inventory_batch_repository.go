package persistence

import (
	"context"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type inventoryBatchRepo struct {
	db *gorm.DB
}

func NewInventoryBatchRepository(db *gorm.DB) outbound.InventoryBatchRepository {
	return &inventoryBatchRepo{db: db}
}

func (r *inventoryBatchRepo) Create(ctx context.Context, b *models.InventoryBatch) error {
	return r.db.WithContext(ctx).Create(b).Error
}

func (r *inventoryBatchRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.InventoryBatch, error) {
	var b models.InventoryBatch
	err := r.db.WithContext(ctx).First(&b, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *inventoryBatchRepo) ListByProductID(ctx context.Context, productID uuid.UUID) ([]*models.InventoryBatch, error) {
	var list []*models.InventoryBatch
	// Order by expiry: nulls last, then ascending (FEFO order)
	err := r.db.WithContext(ctx).
		Where("product_id = ? AND quantity > 0", productID).
		Order("expiry_date IS NULL ASC, expiry_date ASC").
		Find(&list).Error
	return list, err
}

func (r *inventoryBatchRepo) ListByPharmacyID(ctx context.Context, pharmacyID uuid.UUID) ([]*models.InventoryBatch, error) {
	var list []*models.InventoryBatch
	err := r.db.WithContext(ctx).
		Where("pharmacy_id = ?", pharmacyID).
		Preload("Product").
		Order("expiry_date IS NULL ASC, expiry_date ASC").
		Find(&list).Error
	return list, err
}

func (r *inventoryBatchRepo) ListExpiringByPharmacy(ctx context.Context, pharmacyID uuid.UUID, beforeOrOn time.Time) ([]*models.InventoryBatch, error) {
	var list []*models.InventoryBatch
	err := r.db.WithContext(ctx).
		Where("pharmacy_id = ? AND quantity > 0 AND expiry_date IS NOT NULL AND expiry_date <= ?", pharmacyID, beforeOrOn).
		Order("expiry_date ASC").
		Preload("Product").
		Find(&list).Error
	return list, err
}

func (r *inventoryBatchRepo) Update(ctx context.Context, b *models.InventoryBatch) error {
	return r.db.WithContext(ctx).Save(b).Error
}

func (r *inventoryBatchRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.InventoryBatch{}, "id = ?", id).Error
}
