package mocks

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/google/uuid"
)

// MockUserRepository is a mock for UserRepository for unit tests (no DB).
type MockUserRepository struct {
	CreateFunc          func(ctx context.Context, u *models.User) error
	GetByIDFunc         func(ctx context.Context, id uuid.UUID) (*models.User, error)
	GetByEmailFunc      func(ctx context.Context, email string) (*models.User, error)
	GetByPharmacyIDFunc func(ctx context.Context, pharmacyID uuid.UUID) ([]*models.User, error)
	UpdateFunc          func(ctx context.Context, u *models.User) error
}

func (m *MockUserRepository) Create(ctx context.Context, u *models.User) error {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, u)
	}
	return nil
}

func (m *MockUserRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *MockUserRepository) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	if m.GetByEmailFunc != nil {
		return m.GetByEmailFunc(ctx, email)
	}
	return nil, nil
}

func (m *MockUserRepository) GetByPharmacyID(ctx context.Context, pharmacyID uuid.UUID) ([]*models.User, error) {
	if m.GetByPharmacyIDFunc != nil {
		return m.GetByPharmacyIDFunc(ctx, pharmacyID)
	}
	return nil, nil
}

func (m *MockUserRepository) Update(ctx context.Context, u *models.User) error {
	if m.UpdateFunc != nil {
		return m.UpdateFunc(ctx, u)
	}
	return nil
}

// MockPharmacyRepository is a mock for PharmacyRepository for unit tests (no DB).
type MockPharmacyRepository struct {
	CreateFunc  func(ctx context.Context, p *models.Pharmacy) error
	GetByIDFunc func(ctx context.Context, id uuid.UUID) (*models.Pharmacy, error)
	UpdateFunc  func(ctx context.Context, p *models.Pharmacy) error
	ListFunc    func(ctx context.Context) ([]*models.Pharmacy, error)
}

func (m *MockPharmacyRepository) Create(ctx context.Context, p *models.Pharmacy) error {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, p)
	}
	return nil
}

func (m *MockPharmacyRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Pharmacy, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *MockPharmacyRepository) Update(ctx context.Context, p *models.Pharmacy) error {
	if m.UpdateFunc != nil {
		return m.UpdateFunc(ctx, p)
	}
	return nil
}

func (m *MockPharmacyRepository) List(ctx context.Context) ([]*models.Pharmacy, error) {
	if m.ListFunc != nil {
		return m.ListFunc(ctx)
	}
	return nil, nil
}

// MockProductRepository is a mock for ProductRepository for unit tests (no DB).
type MockProductRepository struct {
	CreateFunc                    func(ctx context.Context, p *models.Product) error
	GetByIDFunc                   func(ctx context.Context, id uuid.UUID) (*models.Product, error)
	GetBySKUFunc                  func(ctx context.Context, pharmacyID uuid.UUID, sku string) (*models.Product, error)
	ListByPharmacyFunc            func(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool) ([]*models.Product, error)
	ListByPharmacyPaginatedFunc   func(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool, limit, offset int) ([]*models.Product, int64, error)
	UpdateFunc                    func(ctx context.Context, p *models.Product) error
	DeleteFunc                    func(ctx context.Context, id uuid.UUID) error
}

func (m *MockProductRepository) Create(ctx context.Context, p *models.Product) error {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, p)
	}
	return nil
}

func (m *MockProductRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Product, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *MockProductRepository) GetBySKU(ctx context.Context, pharmacyID uuid.UUID, sku string) (*models.Product, error) {
	if m.GetBySKUFunc != nil {
		return m.GetBySKUFunc(ctx, pharmacyID, sku)
	}
	return nil, nil
}

func (m *MockProductRepository) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool) ([]*models.Product, error) {
	if m.ListByPharmacyFunc != nil {
		return m.ListByPharmacyFunc(ctx, pharmacyID, category, inStockOnly)
	}
	return nil, nil
}

func (m *MockProductRepository) ListByPharmacyPaginated(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool, limit, offset int) ([]*models.Product, int64, error) {
	if m.ListByPharmacyPaginatedFunc != nil {
		return m.ListByPharmacyPaginatedFunc(ctx, pharmacyID, category, inStockOnly, limit, offset)
	}
	return nil, 0, nil
}

func (m *MockProductRepository) Update(ctx context.Context, p *models.Product) error {
	if m.UpdateFunc != nil {
		return m.UpdateFunc(ctx, p)
	}
	return nil
}

func (m *MockProductRepository) Delete(ctx context.Context, id uuid.UUID) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, id)
	}
	return nil
}

// MockProductImageRepository is a mock for ProductImageRepository for unit tests (no DB).
type MockProductImageRepository struct {
	CreateFunc         func(ctx context.Context, img *models.ProductImage) error
	GetByIDFunc        func(ctx context.Context, id uuid.UUID) (*models.ProductImage, error)
	ListByProductIDFunc func(ctx context.Context, productID uuid.UUID) ([]*models.ProductImage, error)
	UpdateFunc         func(ctx context.Context, img *models.ProductImage) error
	DeleteFunc         func(ctx context.Context, id uuid.UUID) error
}

func (m *MockProductImageRepository) Create(ctx context.Context, img *models.ProductImage) error {
	if m.CreateFunc != nil {
		return m.CreateFunc(ctx, img)
	}
	return nil
}

func (m *MockProductImageRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.ProductImage, error) {
	if m.GetByIDFunc != nil {
		return m.GetByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *MockProductImageRepository) ListByProductID(ctx context.Context, productID uuid.UUID) ([]*models.ProductImage, error) {
	if m.ListByProductIDFunc != nil {
		return m.ListByProductIDFunc(ctx, productID)
	}
	return nil, nil
}

func (m *MockProductImageRepository) Update(ctx context.Context, img *models.ProductImage) error {
	if m.UpdateFunc != nil {
		return m.UpdateFunc(ctx, img)
	}
	return nil
}

func (m *MockProductImageRepository) Delete(ctx context.Context, id uuid.UUID) error {
	if m.DeleteFunc != nil {
		return m.DeleteFunc(ctx, id)
	}
	return nil
}
