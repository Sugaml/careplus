package services

import (
	"context"
	"strings"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type productService struct {
	repo     outbound.ProductRepository
	imageRepo outbound.ProductImageRepository
	logger   *zap.Logger
}

func NewProductService(repo outbound.ProductRepository, imageRepo outbound.ProductImageRepository, logger *zap.Logger) inbound.ProductService {
	return &productService{repo: repo, imageRepo: imageRepo, logger: logger}
}

func (s *productService) Create(ctx context.Context, p *models.Product) error {
	if p.Name == "" {
		return errors.ErrValidation("product name is required")
	}
	if p.SKU == "" {
		return errors.ErrValidation("SKU is required")
	}
	existing, _ := s.repo.GetBySKU(ctx, p.PharmacyID, p.SKU)
	if existing != nil {
		return errors.ErrConflict("product with this SKU already exists")
	}
	if p.Currency == "" {
		p.Currency = "NPR"
	}
	if p.Unit == "" {
		p.Unit = "units"
	}
	return s.repo.Create(ctx, p)
}

func (s *productService) GetByID(ctx context.Context, id uuid.UUID) (*models.Product, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *productService) GetByBarcode(ctx context.Context, pharmacyID uuid.UUID, barcode string) (*models.Product, error) {
	return s.repo.GetByBarcode(ctx, pharmacyID, barcode)
}

func (s *productService) List(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool) ([]*models.Product, error) {
	return s.repo.ListByPharmacy(ctx, pharmacyID, category, inStockOnly)
}

func (s *productService) ListPaginated(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool, limit, offset int) ([]*models.Product, int64, error) {
	return s.repo.ListByPharmacyPaginated(ctx, pharmacyID, category, inStockOnly, limit, offset)
}

func (s *productService) ListCatalog(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool, searchQ string, sort inbound.CatalogSort, limit, offset int, filters *inbound.CatalogFilters) ([]*models.Product, int64, error) {
	sortOut := outbound.CatalogSort(strings.TrimSpace(string(sort)))
	if sortOut != outbound.CatalogSortPriceAsc && sortOut != outbound.CatalogSortPriceDesc && sortOut != outbound.CatalogSortNewest {
		sortOut = outbound.CatalogSortName
	}
	var outFilters *outbound.CatalogFilters
	if filters != nil {
		outFilters = &outbound.CatalogFilters{
			Hashtag:    filters.Hashtag,
			Brand:      filters.Brand,
			LabelKey:   filters.LabelKey,
			LabelValue: filters.LabelValue,
		}
	}
	return s.repo.ListByPharmacyCatalog(ctx, pharmacyID, category, inStockOnly, strings.TrimSpace(searchQ), sortOut, limit, offset, outFilters)
}

func (s *productService) Update(ctx context.Context, p *models.Product) error {
	if p.ID == uuid.Nil {
		return errors.ErrValidation("product ID is required")
	}
	return s.repo.Update(ctx, p)
}

func (s *productService) UpdateStock(ctx context.Context, productID uuid.UUID, quantity int) error {
	p, err := s.repo.GetByID(ctx, productID)
	if err != nil || p == nil {
		return errors.ErrNotFound("product")
	}
	p.StockQuantity += quantity
	if p.StockQuantity < 0 {
		return errors.ErrValidation("stock cannot be negative")
	}
	return s.repo.Update(ctx, p)
}

func (s *productService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

func (s *productService) AddImage(ctx context.Context, productID uuid.UUID, url string, isPrimary bool) (*models.ProductImage, error) {
	p, err := s.repo.GetByID(ctx, productID)
	if err != nil || p == nil {
		return nil, errors.ErrNotFound("product")
	}
	existing, _ := s.imageRepo.ListByProductID(ctx, productID)
	if isPrimary {
		for _, img := range existing {
			img.IsPrimary = false
			_ = s.imageRepo.Update(ctx, img)
		}
	} else if len(existing) == 0 {
		isPrimary = true
	}
	sortOrder := len(existing)
	img := &models.ProductImage{ProductID: productID, URL: url, IsPrimary: isPrimary, SortOrder: sortOrder}
	if err := s.imageRepo.Create(ctx, img); err != nil {
		return nil, err
	}
	return img, nil
}

func (s *productService) SetPrimaryImage(ctx context.Context, productID, imageID uuid.UUID) error {
	img, err := s.imageRepo.GetByID(ctx, imageID)
	if err != nil || img == nil {
		return errors.ErrNotFound("product image")
	}
	if img.ProductID != productID {
		return errors.ErrNotFound("product image")
	}
	existing, _ := s.imageRepo.ListByProductID(ctx, productID)
	for _, i := range existing {
		i.IsPrimary = (i.ID == imageID)
		_ = s.imageRepo.Update(ctx, i)
	}
	return nil
}

func (s *productService) ReorderImages(ctx context.Context, productID uuid.UUID, imageIDs []uuid.UUID) error {
	if _, err := s.repo.GetByID(ctx, productID); err != nil {
		return errors.ErrNotFound("product")
	}
	for i, id := range imageIDs {
		img, err := s.imageRepo.GetByID(ctx, id)
		if err != nil || img == nil || img.ProductID != productID {
			continue
		}
		img.SortOrder = i
		_ = s.imageRepo.Update(ctx, img)
	}
	return nil
}

func (s *productService) DeleteImage(ctx context.Context, productID, imageID uuid.UUID) error {
	img, err := s.imageRepo.GetByID(ctx, imageID)
	if err != nil || img == nil {
		return errors.ErrNotFound("product image")
	}
	if img.ProductID != productID {
		return errors.ErrNotFound("product image")
	}
	if err := s.imageRepo.Delete(ctx, imageID); err != nil {
		return err
	}
	if img.IsPrimary {
		remaining, _ := s.imageRepo.ListByProductID(ctx, productID)
		if len(remaining) > 0 {
			remaining[0].IsPrimary = true
			_ = s.imageRepo.Update(ctx, remaining[0])
		}
	}
	return nil
}
