package persistence

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type productRepo struct {
	db *gorm.DB
}

func NewProductRepository(db *gorm.DB) outbound.ProductRepository {
	return &productRepo{db: db}
}

func (r *productRepo) Create(ctx context.Context, p *models.Product) error {
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *productRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Product, error) {
	var p models.Product
	err := r.db.WithContext(ctx).Preload("Images").Preload("CategoryDetail.Parent").First(&p, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *productRepo) GetBySKU(ctx context.Context, pharmacyID uuid.UUID, sku string) (*models.Product, error) {
	var p models.Product
	err := r.db.WithContext(ctx).Where("pharmacy_id = ? AND sku = ?", pharmacyID, sku).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *productRepo) GetByBarcode(ctx context.Context, pharmacyID uuid.UUID, barcode string) (*models.Product, error) {
	if barcode == "" {
		return nil, gorm.ErrRecordNotFound
	}
	var p models.Product
	err := r.db.WithContext(ctx).Preload("Images").Preload("CategoryDetail.Parent").Where("pharmacy_id = ? AND barcode = ?", pharmacyID, barcode).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *productRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool) ([]*models.Product, error) {
	list, _, err := r.ListByPharmacyPaginated(ctx, pharmacyID, category, inStockOnly, 0, 0)
	return list, err
}

func (r *productRepo) ListByPharmacyPaginated(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool, limit, offset int) ([]*models.Product, int64, error) {
	q := r.db.WithContext(ctx).Model(&models.Product{}).Where("pharmacy_id = ?", pharmacyID)
	if category != nil && *category != "" {
		q = q.Where("category = ?", *category)
	}
	if inStockOnly != nil && *inStockOnly {
		q = q.Where("stock_quantity > 0")
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	query := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID)
	if category != nil && *category != "" {
		query = query.Where("category = ?", *category)
	}
	if inStockOnly != nil && *inStockOnly {
		query = query.Where("stock_quantity > 0")
	}
	if limit > 0 {
		query = query.Limit(limit)
	}
	if offset > 0 {
		query = query.Offset(offset)
	}
	var list []*models.Product
	err := query.Preload("Images").Preload("CategoryDetail.Parent").Find(&list).Error
	return list, total, err
}

func (r *productRepo) ListByPharmacyCatalog(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool, searchQ string, sort outbound.CatalogSort, limit, offset int, filters *outbound.CatalogFilters) ([]*models.Product, int64, error) {
	q := r.db.WithContext(ctx).Model(&models.Product{}).Where("pharmacy_id = ? AND is_active = ?", pharmacyID, true)
	if category != nil && *category != "" {
		q = q.Where("category = ?", *category)
	}
	if inStockOnly != nil && *inStockOnly {
		q = q.Where("stock_quantity > 0")
	}
	if searchQ != "" {
		term := "%" + strings.TrimSpace(searchQ) + "%"
		q = q.Where(
			"name ILIKE ? OR description ILIKE ? OR sku ILIKE ? OR brand ILIKE ? OR generic_name ILIKE ?",
			term, term, term, term, term,
		)
	}
	if filters != nil {
		if filters.Hashtag != nil && *filters.Hashtag != "" {
			hashtagArr, _ := json.Marshal([]string{*filters.Hashtag})
			q = q.Where("hashtags @> ?::jsonb", string(hashtagArr))
		}
		if filters.Brand != nil && *filters.Brand != "" {
			q = q.Where("brand ILIKE ?", "%"+*filters.Brand+"%")
		}
		if filters.LabelKey != nil && *filters.LabelKey != "" && filters.LabelValue != nil {
			labelJSON, _ := json.Marshal(map[string]string{*filters.LabelKey: *filters.LabelValue})
			q = q.Where("labels @> ?::jsonb", string(labelJSON))
		}
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	query := r.db.WithContext(ctx).Where("pharmacy_id = ? AND is_active = ?", pharmacyID, true)
	if category != nil && *category != "" {
		query = query.Where("category = ?", *category)
	}
	if inStockOnly != nil && *inStockOnly {
		query = query.Where("stock_quantity > 0")
	}
	if searchQ != "" {
		term := "%" + strings.TrimSpace(searchQ) + "%"
		query = query.Where(
			"name ILIKE ? OR description ILIKE ? OR sku ILIKE ? OR brand ILIKE ? OR generic_name ILIKE ?",
			term, term, term, term, term,
		)
	}
	if filters != nil {
		if filters.Hashtag != nil && *filters.Hashtag != "" {
			hashtagArr, _ := json.Marshal([]string{*filters.Hashtag})
			query = query.Where("hashtags @> ?::jsonb", string(hashtagArr))
		}
		if filters.Brand != nil && *filters.Brand != "" {
			query = query.Where("brand ILIKE ?", "%"+*filters.Brand+"%")
		}
		if filters.LabelKey != nil && *filters.LabelKey != "" && filters.LabelValue != nil {
			labelJSON, _ := json.Marshal(map[string]string{*filters.LabelKey: *filters.LabelValue})
			query = query.Where("labels @> ?::jsonb", string(labelJSON))
		}
	}
	switch sort {
	case outbound.CatalogSortPriceAsc:
		query = query.Order("unit_price ASC, name ASC")
	case outbound.CatalogSortPriceDesc:
		query = query.Order("unit_price DESC, name ASC")
	case outbound.CatalogSortNewest:
		query = query.Order("created_at DESC, name ASC")
	default:
		query = query.Order("name ASC")
	}
	if limit > 0 {
		query = query.Limit(limit)
	}
	if offset > 0 {
		query = query.Offset(offset)
	}
	var list []*models.Product
	err := query.Preload("Images").Preload("CategoryDetail.Parent").Find(&list).Error
	return list, total, err
}

func (r *productRepo) Update(ctx context.Context, p *models.Product) error {
	return r.db.WithContext(ctx).Save(p).Error
}

func (r *productRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Product{}, "id = ?", id).Error
}
