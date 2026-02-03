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

type OrderHandler struct {
	orderService inbound.OrderService
	logger       *zap.Logger
}

func NewOrderHandler(orderService inbound.OrderService, logger *zap.Logger) *OrderHandler {
	return &OrderHandler{orderService: orderService, logger: logger}
}

type createOrderRequest struct {
	CustomerName   string                  `json:"customer_name"`
	CustomerPhone  string                  `json:"customer_phone"`
	CustomerEmail  string                  `json:"customer_email"`
	Items          []inbound.OrderItemInput `json:"items" binding:"required"`
	Notes          string                  `json:"notes"`
	DiscountAmount *float64                `json:"discount_amount"`
	PromoCode      *string                 `json:"promo_code"`
	ReferralCode   *string                 `json:"referral_code"`
	PointsToRedeem *int                    `json:"points_to_redeem"`
}

func (h *OrderHandler) Create(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	userIDStr, _ := c.Get("user_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	userID, _ := uuid.Parse(userIDStr.(string))
	var req createOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	o, err := h.orderService.Create(c.Request.Context(), pharmacyID, userID, req.CustomerName, req.CustomerPhone, req.CustomerEmail, req.Items, req.Notes, req.DiscountAmount, req.PromoCode, req.ReferralCode, req.PointsToRedeem)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, o)
}

func (h *OrderHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	o, err := h.orderService.GetByID(c.Request.Context(), id)
	if err != nil || o == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "order not found"})
		return
	}
	c.JSON(http.StatusOK, o)
}

func (h *OrderHandler) List(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var status *string
	if v := c.Query("status"); v != "" {
		status = &v
	}
	list, err := h.orderService.List(c.Request.Context(), pharmacyID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *OrderHandler) Accept(c *gin.Context) {
	id, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	o, err := h.orderService.Accept(c.Request.Context(), id)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, o)
}

func (h *OrderHandler) UpdateStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	status := models.OrderStatus(body.Status)
	o, err := h.orderService.UpdateStatus(c.Request.Context(), id, status)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, o)
}
