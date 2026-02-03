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

type PharmacyHandler struct {
	pharmacyService inbound.PharmacyService
	logger          *zap.Logger
}

func NewPharmacyHandler(pharmacyService inbound.PharmacyService, logger *zap.Logger) *PharmacyHandler {
	return &PharmacyHandler{pharmacyService: pharmacyService, logger: logger}
}

type pharmacyBody struct {
	Name      string `json:"name" binding:"required"`
	LicenseNo string `json:"license_no" binding:"required"`
	Address   string `json:"address"`
	Phone     string `json:"phone"`
	Email     string `json:"email"`
	IsActive  bool   `json:"is_active"`
}

func (b pharmacyBody) toPharmacy(id uuid.UUID) models.Pharmacy {
	return models.Pharmacy{
		ID:        id,
		Name:      b.Name,
		LicenseNo: b.LicenseNo,
		Address:   b.Address,
		Phone:     b.Phone,
		Email:     b.Email,
		IsActive:  b.IsActive,
	}
}

func (h *PharmacyHandler) Create(c *gin.Context) {
	var body pharmacyBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	p := body.toPharmacy(uuid.Nil)
	if err := h.pharmacyService.Create(c.Request.Context(), &p); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (h *PharmacyHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	p, err := h.pharmacyService.GetByID(c.Request.Context(), id)
	if err != nil || p == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "pharmacy not found"})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *PharmacyHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	var body pharmacyBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	p := body.toPharmacy(id)
	if err := h.pharmacyService.Update(c.Request.Context(), &p); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *PharmacyHandler) List(c *gin.Context) {
	list, err := h.pharmacyService.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func writeServiceError(c *gin.Context, err error) {
	if errors.IsAppError(err) {
		appErr := errors.GetAppError(err)
		switch appErr.Code {
		case errors.ErrCodeValidation:
			c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
			return
		case errors.ErrCodeNotFound:
			c.JSON(http.StatusNotFound, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
			return
		case errors.ErrCodeConflict:
			c.JSON(http.StatusConflict, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
			return
		case errors.ErrCodeForbidden:
			c.JSON(http.StatusForbidden, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
			return
		}
	}
	c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
}
