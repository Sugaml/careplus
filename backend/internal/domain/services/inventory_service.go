package services

import (
	"context"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
)

type inventoryService struct {
	batchRepo   outbound.InventoryBatchRepository
	productRepo outbound.ProductRepository
}

func NewInventoryService(batchRepo outbound.InventoryBatchRepository, productRepo outbound.ProductRepository) inbound.InventoryService {
	return &inventoryService{batchRepo: batchRepo, productRepo: productRepo}
}

func (s *inventoryService) AddBatch(ctx context.Context, pharmacyID, productID uuid.UUID, batchNumber string, quantity int, expiryDate *time.Time) (*models.InventoryBatch, error) {
	if quantity <= 0 {
		return nil, errors.ErrValidation("quantity must be positive")
	}
	prod, err := s.productRepo.GetByID(ctx, productID)
	if err != nil || prod == nil {
		return nil, errors.ErrNotFound("product")
	}
	if prod.PharmacyID != pharmacyID {
		return nil, errors.ErrForbidden("product does not belong to this pharmacy")
	}
	b := &models.InventoryBatch{
		ProductID:   productID,
		PharmacyID:  pharmacyID,
		BatchNumber: batchNumber,
		Quantity:    quantity,
		ExpiryDate:  expiryDate,
	}
	if err := s.batchRepo.Create(ctx, b); err != nil {
		return nil, errors.ErrInternal("failed to create batch", err)
	}
	prod.StockQuantity += quantity
	if err := s.productRepo.Update(ctx, prod); err != nil {
		return nil, errors.ErrInternal("failed to update product stock", err)
	}
	return b, nil
}

func (s *inventoryService) ListBatchesByProduct(ctx context.Context, productID uuid.UUID) ([]*models.InventoryBatch, error) {
	return s.batchRepo.ListByProductID(ctx, productID)
}

func (s *inventoryService) ListBatchesByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.InventoryBatch, error) {
	return s.batchRepo.ListByPharmacyID(ctx, pharmacyID)
}

func (s *inventoryService) ListExpiringSoon(ctx context.Context, pharmacyID uuid.UUID, withinDays int) ([]*models.InventoryBatch, error) {
	deadline := time.Now().AddDate(0, 0, withinDays)
	return s.batchRepo.ListExpiringByPharmacy(ctx, pharmacyID, deadline)
}

func (s *inventoryService) GetBatch(ctx context.Context, id uuid.UUID) (*models.InventoryBatch, error) {
	return s.batchRepo.GetByID(ctx, id)
}

func (s *inventoryService) UpdateBatch(ctx context.Context, id uuid.UUID, quantity *int, expiryDate *time.Time) (*models.InventoryBatch, error) {
	b, err := s.batchRepo.GetByID(ctx, id)
	if err != nil || b == nil {
		return nil, errors.ErrNotFound("inventory batch")
	}
	if quantity != nil {
		if *quantity < 0 {
			return nil, errors.ErrValidation("quantity cannot be negative")
		}
		delta := *quantity - b.Quantity
		b.Quantity = *quantity
		if err := s.batchRepo.Update(ctx, b); err != nil {
			return nil, errors.ErrInternal("failed to update batch", err)
		}
		prod, _ := s.productRepo.GetByID(ctx, b.ProductID)
		if prod != nil {
			prod.StockQuantity += delta
			_ = s.productRepo.Update(ctx, prod)
		}
	} else if expiryDate != nil {
		b.ExpiryDate = expiryDate
		if err := s.batchRepo.Update(ctx, b); err != nil {
			return nil, errors.ErrInternal("failed to update batch", err)
		}
	}
	return s.batchRepo.GetByID(ctx, id)
}

func (s *inventoryService) DeleteBatch(ctx context.Context, id uuid.UUID) error {
	b, err := s.batchRepo.GetByID(ctx, id)
	if err != nil || b == nil {
		return errors.ErrNotFound("inventory batch")
	}
	if err := s.batchRepo.Delete(ctx, id); err != nil {
		return errors.ErrInternal("failed to delete batch", err)
	}
	prod, _ := s.productRepo.GetByID(ctx, b.ProductID)
	if prod != nil {
		prod.StockQuantity -= b.Quantity
		if prod.StockQuantity < 0 {
			prod.StockQuantity = 0
		}
		_ = s.productRepo.Update(ctx, prod)
	}
	return nil
}

// Consume deducts quantity from product stock using FEFO (first expiry, first out).
// If the product has inventory batches, deducts from batches first; then always
// decrements product.StockQuantity. Returns ErrValidation if insufficient stock.
func (s *inventoryService) Consume(ctx context.Context, productID uuid.UUID, quantity int) error {
	if quantity <= 0 {
		return errors.ErrValidation("quantity must be positive")
	}
	prod, err := s.productRepo.GetByID(ctx, productID)
	if err != nil || prod == nil {
		return errors.ErrNotFound("product")
	}
	if prod.StockQuantity < quantity {
		return errors.ErrValidation("insufficient stock for " + prod.Name)
	}
	batches, err := s.batchRepo.ListByProductID(ctx, productID)
	if err != nil {
		return errors.ErrInternal("failed to list batches", err)
	}
	if len(batches) > 0 {
		remaining := quantity
		for _, b := range batches {
			if remaining <= 0 {
				break
			}
			take := remaining
			if take > b.Quantity {
				take = b.Quantity
			}
			b.Quantity -= take
			remaining -= take
			if b.Quantity <= 0 {
				_ = s.batchRepo.Delete(ctx, b.ID)
			} else {
				_ = s.batchRepo.Update(ctx, b)
			}
		}
		if remaining > 0 {
			return errors.ErrValidation("insufficient batch stock for " + prod.Name)
		}
	}
	prod.StockQuantity -= quantity
	return s.productRepo.Update(ctx, prod)
}

func (s *inventoryService) HasBatches(ctx context.Context, productID uuid.UUID) (bool, error) {
	batches, err := s.batchRepo.ListByProductID(ctx, productID)
	if err != nil {
		return false, err
	}
	return len(batches) > 0, nil
}
