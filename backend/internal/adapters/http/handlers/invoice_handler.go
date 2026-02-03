package handlers

import (
	"net/http"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type InvoiceHandler struct {
	invoiceService inbound.InvoiceService
	logger         *zap.Logger
}

func NewInvoiceHandler(invoiceService inbound.InvoiceService, logger *zap.Logger) *InvoiceHandler {
	return &InvoiceHandler{invoiceService: invoiceService, logger: logger}
}

func (h *InvoiceHandler) CreateFromOrder(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	userIDStr, _ := c.Get("user_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	userID, _ := uuid.Parse(userIDStr.(string))
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid order id"})
		return
	}
	inv, err := h.invoiceService.CreateFromOrder(c.Request.Context(), pharmacyID, orderID, userID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, inv)
}

func (h *InvoiceHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	view, err := h.invoiceService.GetByID(c.Request.Context(), id)
	if err != nil || view == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "invoice not found"})
		return
	}
	c.JSON(http.StatusOK, view)
}

func (h *InvoiceHandler) List(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	list, err := h.invoiceService.ListByPharmacy(c.Request.Context(), pharmacyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *InvoiceHandler) Issue(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	inv, err := h.invoiceService.Issue(c.Request.Context(), id)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, inv)
}
