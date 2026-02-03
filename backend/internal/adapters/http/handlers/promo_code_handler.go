package handlers

import (
	"net/http"
	"strconv"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type PromoCodeHandler struct {
	promoCodeService inbound.PromoCodeService
	logger           *zap.Logger
}

func NewPromoCodeHandler(promoCodeService inbound.PromoCodeService, logger *zap.Logger) *PromoCodeHandler {
	return &PromoCodeHandler{promoCodeService: promoCodeService, logger: logger}
}

type validatePromoRequest struct {
	Code      string  `json:"code" binding:"required"`
	SubTotal  float64 `json:"sub_total" binding:"required,min=0"`
}

func (h *PromoCodeHandler) Validate(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	userIDStr, _ := c.Get("user_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var userID *uuid.UUID
	if userIDStr != nil {
		if id, err := uuid.Parse(userIDStr.(string)); err == nil {
			userID = &id
		}
	}
	var req validatePromoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	result, err := h.promoCodeService.Validate(c.Request.Context(), pharmacyID, req.Code, req.SubTotal, userID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *PromoCodeHandler) ValidateQuery(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	userIDStr, _ := c.Get("user_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var userID *uuid.UUID
	if userIDStr != nil {
		if id, err := uuid.Parse(userIDStr.(string)); err == nil {
			userID = &id
		}
	}
	code := c.Query("code")
	subTotalStr := c.Query("sub_total")
	if code == "" || subTotalStr == "" {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "code and sub_total query params required"})
		return
	}
	subTotal, err := strconv.ParseFloat(subTotalStr, 64)
	if err != nil || subTotal < 0 {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "sub_total must be a non-negative number"})
		return
	}
	result, err := h.promoCodeService.Validate(c.Request.Context(), pharmacyID, code, subTotal, userID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *PromoCodeHandler) Create(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var p models.PromoCode
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	created, err := h.promoCodeService.Create(c.Request.Context(), pharmacyID, &p)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, created)
}

func (h *PromoCodeHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	p, err := h.promoCodeService.GetByID(c.Request.Context(), id)
	if err != nil || p == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "promo code not found"})
		return
	}
	c.JSON(http.StatusOK, p)
}

func (h *PromoCodeHandler) List(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	list, err := h.promoCodeService.ListByPharmacy(c.Request.Context(), pharmacyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *PromoCodeHandler) Update(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	var p models.PromoCode
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	p.ID = id
	updated, err := h.promoCodeService.Update(c.Request.Context(), pharmacyID, &p)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, updated)
}
