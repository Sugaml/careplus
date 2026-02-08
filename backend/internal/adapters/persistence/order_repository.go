package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type orderRepo struct {
	db *gorm.DB
}

func NewOrderRepository(db *gorm.DB) outbound.OrderRepository {
	return &orderRepo{db: db}
}

func (r *orderRepo) Create(ctx context.Context, o *models.Order) error {
	return r.db.WithContext(ctx).Create(o).Error
}

func (r *orderRepo) CreateItem(ctx context.Context, item *models.OrderItem) error {
	return r.db.WithContext(ctx).Create(item).Error
}

func (r *orderRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Order, error) {
	var o models.Order
	err := r.db.WithContext(ctx).Preload("Items").Preload("Items.Product").Preload("Items.Product.Images").Preload("PromoCode").First(&o, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (r *orderRepo) GetByOrderNumber(ctx context.Context, pharmacyID uuid.UUID, orderNumber string) (*models.Order, error) {
	var o models.Order
	err := r.db.WithContext(ctx).Where("pharmacy_id = ? AND order_number = ?", pharmacyID, orderNumber).First(&o).Error
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (r *orderRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, status *string) ([]*models.Order, error) {
	q := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID)
	if status != nil && *status != "" {
		q = q.Where("status = ?", *status)
	}
	var list []*models.Order
	err := q.Order("created_at DESC").Find(&list).Error
	return list, err
}

func (r *orderRepo) ListByPharmacyAndCreatedBy(ctx context.Context, pharmacyID uuid.UUID, createdBy uuid.UUID, status *string) ([]*models.Order, error) {
	q := r.db.WithContext(ctx).Where("pharmacy_id = ? AND created_by = ?", pharmacyID, createdBy)
	if status != nil && *status != "" {
		q = q.Where("status = ?", *status)
	}
	var list []*models.Order
	err := q.Order("created_at DESC").Find(&list).Error
	return list, err
}

func (r *orderRepo) Update(ctx context.Context, o *models.Order) error {
	return r.db.WithContext(ctx).Save(o).Error
}

func (r *orderRepo) GetItemsByOrderID(ctx context.Context, orderID uuid.UUID) ([]*models.OrderItem, error) {
	var list []*models.OrderItem
	err := r.db.WithContext(ctx).Preload("Product").Preload("Product.Images").Where("order_id = ?", orderID).Find(&list).Error
	return list, err
}

func (r *orderRepo) CountByCustomerIDAndStatus(ctx context.Context, customerID uuid.UUID, status string) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.Order{}).Where("customer_id = ? AND status = ?", customerID, status).Count(&count).Error
	return count, err
}

func (r *orderRepo) CountByCreatedByAndPharmacy(ctx context.Context, createdBy, pharmacyID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.Order{}).Where("created_by = ? AND pharmacy_id = ?", createdBy, pharmacyID).Count(&count).Error
	return count, err
}

func (r *orderRepo) GetLatestCompletedOrderWithProduct(ctx context.Context, pharmacyID, userID, productID uuid.UUID) (*models.Order, error) {
	var o models.Order
	err := r.db.WithContext(ctx).
		Joins("INNER JOIN order_items ON order_items.order_id = orders.id AND order_items.product_id = ?", productID).
		Where("orders.pharmacy_id = ? AND orders.created_by = ? AND orders.status = ?", pharmacyID, userID, models.OrderStatusCompleted).
		Order("COALESCE(orders.completed_at, orders.updated_at) DESC").
		First(&o).Error
	if err != nil {
		return nil, err
	}
	return &o, nil
}
