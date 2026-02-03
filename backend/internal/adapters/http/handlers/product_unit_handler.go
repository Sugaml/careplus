package handlers

import (
	"net/http"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type ProductUnitHandler struct {
	productUnitService inbound.ProductUnitService
	logger             *zap.Logger
}

func NewProductUnitHandler(productUnitService inbound.ProductUnitService, logger *zap.Logger) *ProductUnitHandler {
	return &ProductUnitHandler{productUnitService: productUnitService, logger: logger}
}

func (h *ProductUnitHandler) Create(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var u models.ProductUnit
	if err := c.ShouldBindJSON(&u); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	u.PharmacyID = pharmacyID
	if err := h.productUnitService.Create(c.Request.Context(), &u); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, u)
}

func (h *ProductUnitHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	u, err := h.productUnitService.GetByID(c.Request.Context(), id)
	if err != nil || u == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "product unit not found"})
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *ProductUnitHandler) List(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	list, err := h.productUnitService.ListByPharmacy(c.Request.Context(), pharmacyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *ProductUnitHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	var u models.ProductUnit
	if err := c.ShouldBindJSON(&u); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	u.ID = id
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	u.PharmacyID = pharmacyID
	if err := h.productUnitService.Update(c.Request.Context(), &u); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, u)
}

func (h *ProductUnitHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	if err := h.productUnitService.Delete(c.Request.Context(), id); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
