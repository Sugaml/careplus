package handlers

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

const productImageMaxSize = 10 << 20 // 10 MiB

// dateOnly parses JSON as date-only "2006-01-02" or full RFC3339 so frontend can send "2026-03-24".
type dateOnly time.Time

func (d *dateOnly) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		return nil
	}
	for _, layout := range []string{time.DateOnly, time.RFC3339} {
		parsed, err := time.Parse(layout, s)
		if err == nil {
			*d = dateOnly(parsed)
			return nil
		}
	}
	return fmt.Errorf("invalid date: %q (use YYYY-MM-DD or RFC3339)", s)
}

func (d *dateOnly) toTime() *time.Time {
	if d == nil {
		return nil
	}
	t := time.Time(*d)
	if t.IsZero() {
		return nil
	}
	return &t
}

// productBody is used for Create/Update so expiry_date and manufacturing_date accept "YYYY-MM-DD".
// Required: name, sku. Optional: unit_price (defaults to 0), description, category, category_id (FK; when set, category name is synced), etc.
type productBody struct {
	Name               string            `json:"name" binding:"required"`
	Description        string            `json:"description"`
	SKU                string            `json:"sku" binding:"required"`
	Category           string            `json:"category"`
	CategoryID         *string           `json:"category_id,omitempty"` // optional FK; product type = category (parent) + subcategory
	UnitPrice          float64           `json:"unit_price" binding:"gte=0"`
	DiscountPercent    float64           `json:"discount_percent" binding:"gte=0,lte=100"`
	Currency           string            `json:"currency"`
	StockQuantity      int               `json:"stock_quantity" binding:"gte=0"`
	Unit               string            `json:"unit"`
	RequiresRx         bool              `json:"requires_rx"`
	IsActive           bool              `json:"is_active"`
	ExpiryDate         *dateOnly         `json:"expiry_date,omitempty"`
	ManufacturingDate  *dateOnly         `json:"manufacturing_date,omitempty"`
	Brand              string            `json:"brand"`
	Barcode            string            `json:"barcode"`
	StorageConditions  string            `json:"storage_conditions"`
	DosageForm         string            `json:"dosage_form"`
	PackSize           string            `json:"pack_size"`
	GenericName        string            `json:"generic_name"`
	Hashtags           []string          `json:"hashtags,omitempty"`
	Labels             map[string]string `json:"labels,omitempty"`
}

func (b *productBody) toProduct(id uuid.UUID, pharmacyID uuid.UUID) models.Product {
	p := models.Product{
		ID:                id,
		PharmacyID:        pharmacyID,
		Name:              b.Name,
		Description:       b.Description,
		SKU:               b.SKU,
		Category:          b.Category,
		UnitPrice:         b.UnitPrice,
		DiscountPercent:   b.DiscountPercent,
		Currency:          b.Currency,
		StockQuantity:     b.StockQuantity,
		Unit:              b.Unit,
		RequiresRx:        b.RequiresRx,
		IsActive:          b.IsActive,
		Brand:             b.Brand,
		Barcode:           b.Barcode,
		StorageConditions: b.StorageConditions,
		DosageForm:        b.DosageForm,
		PackSize:          b.PackSize,
		GenericName:       b.GenericName,
		Hashtags:          b.Hashtags,
		Labels:            b.Labels,
	}
	if b.CategoryID != nil && *b.CategoryID != "" {
		if cid, err := uuid.Parse(*b.CategoryID); err == nil {
			p.CategoryID = &cid
		}
	}
	p.ExpiryDate = b.ExpiryDate.toTime()
	p.ManufacturingDate = b.ManufacturingDate.toTime()
	return p
}

type ProductHandler struct {
	productService  inbound.ProductService
	categoryService inbound.CategoryService
	storage         outbound.FileStorage
	reviewRepo      outbound.ProductReviewRepository
	logger          *zap.Logger
}

// catalogProductResponse extends Product with optional rating stats for catalog listing.
type catalogProductResponse struct {
	models.Product
	RatingAvg   float64 `json:"rating_avg,omitempty"`
	ReviewCount int     `json:"review_count,omitempty"`
}

func NewProductHandler(productService inbound.ProductService, categoryService inbound.CategoryService, storage outbound.FileStorage, reviewRepo outbound.ProductReviewRepository, logger *zap.Logger) *ProductHandler {
	return &ProductHandler{productService: productService, categoryService: categoryService, storage: storage, reviewRepo: reviewRepo, logger: logger}
}

func (h *ProductHandler) Create(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var body productBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	p := body.toProduct(uuid.Nil, pharmacyID)
	if p.CategoryID != nil {
		if cat, err := h.categoryService.GetByID(c.Request.Context(), *p.CategoryID); err == nil && cat != nil && cat.PharmacyID == pharmacyID {
			p.Category = cat.Name
		}
	}
	if err := h.productService.Create(c.Request.Context(), &p); err != nil {
		writeServiceError(c, err)
		return
	}
	// Preload category_detail (with parent) for response
	if p.CategoryID != nil {
		if cat, _ := h.categoryService.GetByID(c.Request.Context(), *p.CategoryID); cat != nil {
			if cat.ParentID != nil {
				if parent, _ := h.categoryService.GetByID(c.Request.Context(), *cat.ParentID); parent != nil {
					cat.Parent = parent
				}
			}
			p.CategoryDetail = cat
		}
	}
	c.JSON(http.StatusCreated, p)
}

func (h *ProductHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	p, err := h.productService.GetByID(c.Request.Context(), id)
	if err != nil || p == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "product not found"})
		return
	}
	c.JSON(http.StatusOK, p)
}

// GetByBarcode returns the product for the current pharmacy with the given barcode (auth required).
func (h *ProductHandler) GetByBarcode(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	barcode := strings.TrimSpace(c.Param("barcode"))
	if barcode == "" {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "barcode is required"})
		return
	}
	p, err := h.productService.GetByBarcode(c.Request.Context(), pharmacyID, barcode)
	if err != nil || p == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "product not found"})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *ProductHandler) List(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var category *string
	var inStock *bool
	if v := c.Query("category"); v != "" {
		category = &v
	}
	if v := c.Query("in_stock"); v == "true" || v == "1" {
		t := true
		inStock = &t
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "0"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	searchQ := strings.TrimSpace(c.Query("q"))
	if searchQ != "" {
		if limit <= 0 {
			limit = 20
		}
		list, total, err := h.productService.ListCatalog(c.Request.Context(), pharmacyID, category, inStock, searchQ, inbound.CatalogSortName, limit, offset, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": list, "total": total})
		return
	}
	if limit > 0 {
		list, total, err := h.productService.ListPaginated(c.Request.Context(), pharmacyID, category, inStock, limit, offset)
		if err != nil {
			c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": list, "total": total})
		return
	}
	list, err := h.productService.List(c.Request.Context(), pharmacyID, category, inStock)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// ListByPharmacyID lists products for a pharmacy by path param (public, no auth).
// Supports catalog params: q (search), sort (name|price_asc|price_desc|newest), category, in_stock, limit, offset.
func (h *ProductHandler) ListByPharmacyID(c *gin.Context) {
	pharmacyID, err := uuid.Parse(c.Param("pharmacyId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy id"})
		return
	}
	var category *string
	var inStock *bool
	if v := c.Query("category"); v != "" {
		category = &v
	}
	if v := c.Query("in_stock"); v == "true" || v == "1" {
		t := true
		inStock = &t
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "0"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	searchQ := strings.TrimSpace(c.Query("q"))
	sortParam := strings.TrimSpace(strings.ToLower(c.Query("sort")))
	hashtag := strings.TrimSpace(c.Query("hashtag"))
	brand := strings.TrimSpace(c.Query("brand"))
	labelKey := strings.TrimSpace(c.Query("label_key"))
	labelValue := strings.TrimSpace(c.Query("label_value"))
	useCatalog := searchQ != "" || sortParam != "" || hashtag != "" || brand != "" || (labelKey != "" && labelValue != "")

	if useCatalog {
		sortVal := inbound.CatalogSortName
		switch sortParam {
		case "price_asc":
			sortVal = inbound.CatalogSortPriceAsc
		case "price_desc":
			sortVal = inbound.CatalogSortPriceDesc
		case "newest":
			sortVal = inbound.CatalogSortNewest
		case "name":
			sortVal = inbound.CatalogSortName
		}
		if limit <= 0 {
			limit = 12
		}
		var filters *inbound.CatalogFilters
		if hashtag != "" || brand != "" || (labelKey != "" && labelValue != "") {
			filters = &inbound.CatalogFilters{}
			if hashtag != "" {
				filters.Hashtag = &hashtag
			}
			if brand != "" {
				filters.Brand = &brand
			}
			if labelKey != "" && labelValue != "" {
				filters.LabelKey = &labelKey
				filters.LabelValue = &labelValue
			}
		}
		list, total, err := h.productService.ListCatalog(c.Request.Context(), pharmacyID, category, inStock, searchQ, sortVal, limit, offset, filters)
		if err != nil {
			c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
			return
		}
		// Enrich with rating stats for catalog display
		ids := make([]uuid.UUID, len(list))
		for i, p := range list {
			ids[i] = p.ID
		}
		stats, _ := h.reviewRepo.GetRatingStatsByProductIDs(c.Request.Context(), ids)
		items := make([]catalogProductResponse, len(list))
		for i, p := range list {
			s := stats[p.ID]
			items[i] = catalogProductResponse{Product: *p, RatingAvg: s.Avg, ReviewCount: s.Count}
		}
		c.JSON(http.StatusOK, gin.H{"items": items, "total": total})
		return
	}

	if limit > 0 {
		list, total, err := h.productService.ListPaginated(c.Request.Context(), pharmacyID, category, inStock, limit, offset)
		if err != nil {
			c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": list, "total": total})
		return
	}
	list, err := h.productService.List(c.Request.Context(), pharmacyID, category, inStock)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ProductHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var body productBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	p := body.toProduct(id, pharmacyID)
	if p.CategoryID != nil {
		if cat, err := h.categoryService.GetByID(c.Request.Context(), *p.CategoryID); err == nil && cat != nil && cat.PharmacyID == pharmacyID {
			p.Category = cat.Name
		}
	}
	if err := h.productService.Update(c.Request.Context(), &p); err != nil {
		writeServiceError(c, err)
		return
	}
	// Preload category_detail (with parent) for response
	if p.CategoryID != nil {
		if cat, _ := h.categoryService.GetByID(c.Request.Context(), *p.CategoryID); cat != nil {
			if cat.ParentID != nil {
				if parent, _ := h.categoryService.GetByID(c.Request.Context(), *cat.ParentID); parent != nil {
					cat.Parent = parent
				}
			}
			p.CategoryDetail = cat
		}
	}
	c.JSON(http.StatusOK, p)
}

func (h *ProductHandler) UpdateStock(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	var body struct {
		Quantity int `json:"quantity" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	if err := h.productService.UpdateStock(c.Request.Context(), id, body.Quantity); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "stock updated"})
}

func (h *ProductHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	if err := h.productService.Delete(c.Request.Context(), id); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// AddImage uploads an image for a product (multipart form "file", optional "is_primary" = true/false).
func (h *ProductHandler) AddImage(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid product id"})
		return
	}
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	p, err := h.productService.GetByID(c.Request.Context(), productID)
	if err != nil || p == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "product not found"})
		return
	}
	if p.PharmacyID != pharmacyID {
		c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "product does not belong to your pharmacy"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "missing file in form"})
		return
	}
	if file.Size > productImageMaxSize {
		c.JSON(http.StatusRequestEntityTooLarge, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "file too large (max 10MB)"})
		return
	}
	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "failed to read file"})
		return
	}
	defer f.Close()

	contentType := file.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	if !strings.HasPrefix(contentType, "image/") {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "file must be an image"})
		return
	}

	ext := filepath.Ext(file.Filename)
	if ext == "" {
		ext = ".jpg"
	}
	path := filepath.Join("photos", "products", productID.String(), time.Now().Format("2006/01"), uuid.New().String()+ext)
	path = filepath.ToSlash(path)

	url, err := h.storage.Save(c.Request.Context(), path, f, contentType)
	if err != nil {
		h.logger.Error("product image save failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "upload failed"})
		return
	}

	isPrimary := strings.EqualFold(c.PostForm("is_primary"), "true")
	img, err := h.productService.AddImage(c.Request.Context(), productID, url, isPrimary)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, img)
}

// SetPrimaryImage sets an image as the primary for the product.
func (h *ProductHandler) SetPrimaryImage(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid product id"})
		return
	}
	imageID, err := uuid.Parse(c.Param("imageId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid image id"})
		return
	}
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	p, err := h.productService.GetByID(c.Request.Context(), productID)
	if err != nil || p == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "product not found"})
		return
	}
	if p.PharmacyID != pharmacyID {
		c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "product does not belong to your pharmacy"})
		return
	}
	if err := h.productService.SetPrimaryImage(c.Request.Context(), productID, imageID); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "primary image updated"})
}

// ReorderImages sets the display order of product images. Body: { "image_ids": ["uuid", ...] }.
func (h *ProductHandler) ReorderImages(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid product id"})
		return
	}
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	p, err := h.productService.GetByID(c.Request.Context(), productID)
	if err != nil || p == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "product not found"})
		return
	}
	if p.PharmacyID != pharmacyID {
		c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "product does not belong to your pharmacy"})
		return
	}
	var body struct {
		ImageIDs []string `json:"image_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	ids := make([]uuid.UUID, 0, len(body.ImageIDs))
	for _, s := range body.ImageIDs {
		id, err := uuid.Parse(s)
		if err != nil {
			continue
		}
		ids = append(ids, id)
	}
	if err := h.productService.ReorderImages(c.Request.Context(), productID, ids); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "images reordered"})
}

// DeleteImage removes an image from a product.
func (h *ProductHandler) DeleteImage(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid product id"})
		return
	}
	imageID, err := uuid.Parse(c.Param("imageId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid image id"})
		return
	}
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	p, err := h.productService.GetByID(c.Request.Context(), productID)
	if err != nil || p == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "product not found"})
		return
	}
	if p.PharmacyID != pharmacyID {
		c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "product does not belong to your pharmacy"})
		return
	}
	if err := h.productService.DeleteImage(c.Request.Context(), productID, imageID); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "image deleted"})
}
