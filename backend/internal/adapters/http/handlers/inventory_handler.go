package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type InventoryHandler struct {
	inventoryService inbound.InventoryService
}

func NewInventoryHandler(inventoryService inbound.InventoryService) *InventoryHandler {
	return &InventoryHandler{inventoryService: inventoryService}
}

// ListBatchesByProduct returns inventory batches for a product (auth, product must belong to pharmacy).
func (h *InventoryHandler) ListBatchesByProduct(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid product id"})
		return
	}
	list, err := h.inventoryService.ListBatchesByProduct(c.Request.Context(), productID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// AddBatch creates a new inventory batch for a product.
func (h *InventoryHandler) AddBatch(c *gin.Context) {
	productID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid product id"})
		return
	}
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var body struct {
		BatchNumber string    `json:"batch_number" binding:"required"`
		Quantity    int       `json:"quantity" binding:"required,min=1"`
		ExpiryDate  *dateOnly `json:"expiry_date"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	var expiry *time.Time
	if body.ExpiryDate != nil {
		expiry = body.ExpiryDate.toTime()
	}
	b, err := h.inventoryService.AddBatch(c.Request.Context(), pharmacyID, productID, body.BatchNumber, body.Quantity, expiry)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, b)
}

// ListBatchesByPharmacy returns all inventory batches for the current pharmacy.
func (h *InventoryHandler) ListBatchesByPharmacy(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	list, err := h.inventoryService.ListBatchesByPharmacy(c.Request.Context(), pharmacyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// ListExpiringSoon returns batches expiring within N days (query: days=30, default 30).
func (h *InventoryHandler) ListExpiringSoon(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	days := 30
	if v := c.Query("days"); v != "" {
		if d, err := strconv.Atoi(v); err == nil && d > 0 {
			days = d
		}
	}
	list, err := h.inventoryService.ListExpiringSoon(c.Request.Context(), pharmacyID, days)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// GetBatch returns a single batch by ID.
func (h *InventoryHandler) GetBatch(c *gin.Context) {
	id, err := uuid.Parse(c.Param("batchId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid batch id"})
		return
	}
	b, err := h.inventoryService.GetBatch(c.Request.Context(), id)
	if err != nil || b == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "batch not found"})
		return
	}
	c.JSON(http.StatusOK, b)
}

// UpdateBatch updates batch quantity and/or expiry date.
func (h *InventoryHandler) UpdateBatch(c *gin.Context) {
	id, err := uuid.Parse(c.Param("batchId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid batch id"})
		return
	}
	var body struct {
		Quantity   *int       `json:"quantity"`
		ExpiryDate *dateOnly  `json:"expiry_date"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	if body.Quantity == nil && body.ExpiryDate == nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "provide quantity and/or expiry_date"})
		return
	}
	var expiry *time.Time
	if body.ExpiryDate != nil {
		expiry = body.ExpiryDate.toTime()
	}
	b, err := h.inventoryService.UpdateBatch(c.Request.Context(), id, body.Quantity, expiry)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, b)
}

// DeleteBatch deletes a batch and adjusts product stock.
func (h *InventoryHandler) DeleteBatch(c *gin.Context) {
	id, err := uuid.Parse(c.Param("batchId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid batch id"})
		return
	}
	if err := h.inventoryService.DeleteBatch(c.Request.Context(), id); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "batch deleted"})
}
