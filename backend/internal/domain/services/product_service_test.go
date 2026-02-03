package services

import (
	"context"
	"errors"
	"testing"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/mocks/outbound"
	pkgerrors "github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

func TestProductService_Create_Success(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockProductRepository{}

	repo.GetBySKUFunc = func(ctx context.Context, pharmacyID uuid.UUID, sku string) (*models.Product, error) {
		return nil, nil // SKU not taken
	}
	var created *models.Product
	repo.CreateFunc = func(ctx context.Context, p *models.Product) error {
		created = p
		return nil
	}

	imgRepo := &mocks.MockProductImageRepository{}
	svc := NewProductService(repo, imgRepo, logger)
	pharmacyID := uuid.New()
	p := &models.Product{PharmacyID: pharmacyID, Name: "Product A", SKU: "SKU-001", UnitPrice: 10.5}
	err := svc.Create(ctx, p)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if created != p {
		t.Error("expected Create to be called with same product")
	}
	if created.Currency != "NPR" || created.Unit != "units" {
		t.Errorf("expected defaults: currency=NPR unit=units, got %q %q", created.Currency, created.Unit)
	}
}

func TestProductService_Create_Validation_NameRequired(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockProductRepository{}
	repo.CreateFunc = func(ctx context.Context, p *models.Product) error {
		t.Fatal("Create should not be called when validation fails")
		return nil
	}

	imgRepo := &mocks.MockProductImageRepository{}
	svc := NewProductService(repo, imgRepo, logger)
	err := svc.Create(ctx, &models.Product{PharmacyID: uuid.New(), SKU: "SKU-1", UnitPrice: 1})
	if err == nil {
		t.Fatal("expected validation error for empty name")
	}
	appErr := pkgerrors.GetAppError(err)
	if appErr == nil || appErr.Code != pkgerrors.ErrCodeValidation {
		t.Errorf("expected VALIDATION_ERROR, got %v", err)
	}
}

func TestProductService_Create_SKUConflict(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockProductRepository{}

	pharmacyID := uuid.New()
	repo.GetBySKUFunc = func(ctx context.Context, pid uuid.UUID, sku string) (*models.Product, error) {
		if pid == pharmacyID && sku == "SKU-EXISTS" {
			return &models.Product{SKU: sku}, nil
		}
		return nil, nil
	}
	repo.CreateFunc = func(ctx context.Context, p *models.Product) error {
		t.Fatal("Create should not be called when SKU exists")
		return nil
	}

	imgRepo := &mocks.MockProductImageRepository{}
	svc := NewProductService(repo, imgRepo, logger)
	err := svc.Create(ctx, &models.Product{PharmacyID: pharmacyID, Name: "X", SKU: "SKU-EXISTS", UnitPrice: 1})
	if err == nil {
		t.Fatal("expected conflict error for duplicate SKU")
	}
	appErr := pkgerrors.GetAppError(err)
	if appErr == nil || appErr.Code != pkgerrors.ErrCodeConflict {
		t.Errorf("expected CONFLICT error, got %v", err)
	}
}

func TestProductService_GetByID_Success(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockProductRepository{}

	id := uuid.New()
	expected := &models.Product{ID: id, Name: "Product", SKU: "SKU-1"}
	repo.GetByIDFunc = func(ctx context.Context, gotID uuid.UUID) (*models.Product, error) {
		if gotID == id {
			return expected, nil
		}
		return nil, errors.New("not found")
	}

	imgRepo := &mocks.MockProductImageRepository{}
	svc := NewProductService(repo, imgRepo, logger)
	got, err := svc.GetByID(ctx, id)
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if got != expected {
		t.Errorf("expected %+v, got %+v", expected, got)
	}
}

func TestProductService_List_Success(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockProductRepository{}

	pharmacyID := uuid.New()
	list := []*models.Product{
		{ID: uuid.New(), PharmacyID: pharmacyID, Name: "A", SKU: "SKU-A"},
		{ID: uuid.New(), PharmacyID: pharmacyID, Name: "B", SKU: "SKU-B"},
	}
	repo.ListByPharmacyFunc = func(ctx context.Context, pid uuid.UUID, category *string, inStockOnly *bool) ([]*models.Product, error) {
		if pid == pharmacyID {
			return list, nil
		}
		return nil, nil
	}

	imgRepo := &mocks.MockProductImageRepository{}
	svc := NewProductService(repo, imgRepo, logger)
	got, err := svc.List(ctx, pharmacyID, nil, nil)
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(got) != 2 || got[0] != list[0] || got[1] != list[1] {
		t.Errorf("unexpected list: %+v", got)
	}
}

func TestProductService_UpdateStock_Success(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockProductRepository{}

	productID := uuid.New()
	p := &models.Product{ID: productID, StockQuantity: 10}
	repo.GetByIDFunc = func(ctx context.Context, id uuid.UUID) (*models.Product, error) {
		if id == productID {
			return p, nil
		}
		return nil, errors.New("not found")
	}
	var updated *models.Product
	repo.UpdateFunc = func(ctx context.Context, prod *models.Product) error {
		updated = prod
		return nil
	}

	imgRepo := &mocks.MockProductImageRepository{}
	svc := NewProductService(repo, imgRepo, logger)
	err := svc.UpdateStock(ctx, productID, 5)
	if err != nil {
		t.Fatalf("UpdateStock failed: %v", err)
	}
	if updated.StockQuantity != 15 {
		t.Errorf("expected stock 15, got %d", updated.StockQuantity)
	}
}

func TestProductService_UpdateStock_ProductNotFound(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockProductRepository{}
	repo.GetByIDFunc = func(ctx context.Context, id uuid.UUID) (*models.Product, error) {
		return nil, errors.New("not found")
	}
	repo.UpdateFunc = func(ctx context.Context, p *models.Product) error {
		t.Fatal("Update should not be called when product not found")
		return nil
	}

	imgRepo := &mocks.MockProductImageRepository{}
	svc := NewProductService(repo, imgRepo, logger)
	err := svc.UpdateStock(ctx, uuid.New(), 5)
	if err == nil {
		t.Fatal("expected not found error")
	}
	appErr := pkgerrors.GetAppError(err)
	if appErr == nil || appErr.Code != pkgerrors.ErrCodeNotFound {
		t.Errorf("expected NOT_FOUND error, got %v", err)
	}
}

func TestProductService_Delete_Success(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockProductRepository{}

	id := uuid.New()
	called := false
	repo.DeleteFunc = func(ctx context.Context, gotID uuid.UUID) error {
		if gotID == id {
			called = true
			return nil
		}
		return errors.New("not found")
	}

	imgRepo := &mocks.MockProductImageRepository{}
	svc := NewProductService(repo, imgRepo, logger)
	err := svc.Delete(ctx, id)
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
	if !called {
		t.Error("expected Delete to be called")
	}
}
