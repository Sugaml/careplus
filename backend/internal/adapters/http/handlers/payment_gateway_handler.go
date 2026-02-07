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

type PaymentGatewayHandler struct {
	paymentGatewayService inbound.PaymentGatewayService
	logger                 *zap.Logger
}

func NewPaymentGatewayHandler(paymentGatewayService inbound.PaymentGatewayService, logger *zap.Logger) *PaymentGatewayHandler {
	return &PaymentGatewayHandler{paymentGatewayService: paymentGatewayService, logger: logger}
}

// ListActiveByPharmacyID returns active payment gateways for a pharmacy (public, for checkout UI).
func (h *PaymentGatewayHandler) ListActiveByPharmacyID(c *gin.Context) {
	pharmacyID, err := uuid.Parse(c.Param("pharmacyId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy id"})
		return
	}
	list, err := h.paymentGatewayService.ListByPharmacy(c.Request.Context(), pharmacyID, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// List returns payment gateways for the authenticated user's pharmacy.
func (h *PaymentGatewayHandler) List(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	activeOnly := c.Query("active") == "true"
	list, err := h.paymentGatewayService.ListByPharmacy(c.Request.Context(), pharmacyID, activeOnly)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// GetByID returns a single payment gateway by ID (must belong to user's pharmacy).
func (h *PaymentGatewayHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	pg, err := h.paymentGatewayService.GetByID(c.Request.Context(), id)
	if err != nil || pg == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "payment gateway not found"})
		return
	}
	if pg.PharmacyID != pharmacyID {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "payment gateway not found"})
		return
	}
	c.JSON(http.StatusOK, pg)
}

// Create creates a new payment gateway (admin).
func (h *PaymentGatewayHandler) Create(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var pg models.PaymentGateway
	if err := c.ShouldBindJSON(&pg); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	created, err := h.paymentGatewayService.Create(c.Request.Context(), pharmacyID, &pg)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, created)
}

// Update updates a payment gateway (admin).
func (h *PaymentGatewayHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var pg models.PaymentGateway
	if err := c.ShouldBindJSON(&pg); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	pg.ID = id
	updated, err := h.paymentGatewayService.Update(c.Request.Context(), pharmacyID, &pg)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, updated)
}

// Delete deletes a payment gateway (admin).
func (h *PaymentGatewayHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	if err := h.paymentGatewayService.Delete(c.Request.Context(), pharmacyID, id); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
