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
	orderService             inbound.OrderService
	orderFeedbackService     inbound.OrderFeedbackService
	orderReturnRequestService inbound.OrderReturnRequestService
	logger                   *zap.Logger
}

func NewOrderHandler(orderService inbound.OrderService, orderFeedbackService inbound.OrderFeedbackService, orderReturnRequestService inbound.OrderReturnRequestService, logger *zap.Logger) *OrderHandler {
	return &OrderHandler{
		orderService:             orderService,
		orderFeedbackService:     orderFeedbackService,
		orderReturnRequestService: orderReturnRequestService,
		logger:                   logger,
	}
}

type createOrderRequest struct {
	CustomerName      string                   `json:"customer_name"`
	CustomerPhone     string                   `json:"customer_phone"`
	CustomerEmail     string                   `json:"customer_email"`
	Items             []inbound.OrderItemInput  `json:"items" binding:"required"`
	Notes             string                   `json:"notes"`
	DeliveryAddress   string                   `json:"delivery_address"` // optional; selected user address for delivery
	DiscountAmount    *float64                 `json:"discount_amount"`
	PromoCode         *string                  `json:"promo_code"`
	ReferralCode      *string                  `json:"referral_code"`
	PointsToRedeem    *int                     `json:"points_to_redeem"`
	PaymentGatewayID  *string                  `json:"payment_gateway_id"` // optional; mock payment will be recorded
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
	var paymentGatewayID *uuid.UUID
	if req.PaymentGatewayID != nil && *req.PaymentGatewayID != "" {
		if parsed, err := uuid.Parse(*req.PaymentGatewayID); err == nil {
			paymentGatewayID = &parsed
		}
	}
	o, err := h.orderService.Create(c.Request.Context(), pharmacyID, userID, req.CustomerName, req.CustomerPhone, req.CustomerEmail, req.Items, req.Notes, req.DeliveryAddress, req.DiscountAmount, req.PromoCode, req.ReferralCode, req.PointsToRedeem, paymentGatewayID)
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
	// End users (role "staff") may only view their own orders.
	if roleVal, ok := c.Get("role"); ok {
		if roleStr, _ := roleVal.(string); roleStr == "staff" {
			userIDStr, _ := c.Get("user_id")
			if userIDStr != nil {
				if userID, parseErr := uuid.Parse(userIDStr.(string)); parseErr == nil && o.CreatedBy != userID {
					c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "you can only view your own orders"})
					return
				}
			}
		}
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
	// End users (role "staff") see only their own orders; others see all pharmacy orders.
	var createdBy *uuid.UUID
	if roleVal, ok := c.Get("role"); ok {
		if roleStr, _ := roleVal.(string); roleStr == "staff" {
			if userIDStr, ok2 := c.Get("user_id"); ok2 {
				if uid, err := uuid.Parse(userIDStr.(string)); err == nil {
					createdBy = &uid
				}
			}
		}
	}
	list, err := h.orderService.List(c.Request.Context(), pharmacyID, createdBy, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *OrderHandler) Accept(c *gin.Context) {
	// Only staff roles (admin/manager/pharmacist) may accept orders; end users (role "staff") may not.
	if roleVal, ok := c.Get("role"); ok {
		if roleStr, _ := roleVal.(string); roleStr == "staff" {
			c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "end users cannot accept orders"})
			return
		}
	}
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
	// Only staff roles (admin/manager/pharmacist) may change order status; end users (role "staff") may not.
	if roleVal, ok := c.Get("role"); ok {
		if roleStr, _ := roleVal.(string); roleStr == "staff" {
			c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "end users cannot update order status"})
			return
		}
	}
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

type createOrderFeedbackRequest struct {
	Rating  int    `json:"rating" binding:"required,min=1,max=5"`
	Comment string `json:"comment"`
}

func (h *OrderHandler) CreateFeedback(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid order id"})
		return
	}
	userIDStr, _ := c.Get("user_id")
	if userIDStr == nil {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "authentication required"})
		return
	}
	userID, _ := uuid.Parse(userIDStr.(string))
	var body createOrderFeedbackRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	f, err := h.orderFeedbackService.Create(c.Request.Context(), orderID, userID, body.Rating, body.Comment)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, f)
}

func (h *OrderHandler) GetFeedback(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid order id"})
		return
	}
	// Ensure user can view this order (same check as GetByID).
	o, err := h.orderService.GetByID(c.Request.Context(), orderID)
	if err != nil || o == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "order not found"})
		return
	}
	if roleVal, ok := c.Get("role"); ok {
		if roleStr, _ := roleVal.(string); roleStr == "staff" {
			userIDStr, _ := c.Get("user_id")
			if userIDStr != nil {
				if userID, parseErr := uuid.Parse(userIDStr.(string)); parseErr == nil && o.CreatedBy != userID {
					c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "you can only view your own orders"})
					return
				}
			}
		}
	}
	f, err := h.orderFeedbackService.GetByOrderID(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	if f == nil {
		c.JSON(http.StatusOK, nil)
		return
	}
	c.JSON(http.StatusOK, f)
}

type createReturnRequestBody struct {
	VideoURL    string   `json:"video_url"`
	PhotoURLs   []string `json:"photo_urls"`
	Notes       string   `json:"notes"`
	Description string   `json:"description"`
}

func (h *OrderHandler) CreateReturnRequest(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid order id"})
		return
	}
	userIDStr, _ := c.Get("user_id")
	if userIDStr == nil {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "authentication required"})
		return
	}
	userID, _ := uuid.Parse(userIDStr.(string))
	var body createReturnRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	req, err := h.orderReturnRequestService.Create(c.Request.Context(), orderID, userID, body.VideoURL, body.PhotoURLs, body.Notes, body.Description)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, req)
}

func (h *OrderHandler) GetReturnRequest(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("orderId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid order id"})
		return
	}
	o, err := h.orderService.GetByID(c.Request.Context(), orderID)
	if err != nil || o == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "order not found"})
		return
	}
	if roleVal, ok := c.Get("role"); ok {
		if roleStr, _ := roleVal.(string); roleStr == "staff" {
			userIDStr, _ := c.Get("user_id")
			if userIDStr != nil {
				if userID, parseErr := uuid.Parse(userIDStr.(string)); parseErr == nil && o.CreatedBy != userID {
					c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "you can only view your own orders"})
					return
				}
			}
		}
	}
	req, err := h.orderReturnRequestService.GetByOrderID(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	if req == nil {
		c.JSON(http.StatusOK, nil)
		return
	}
	c.JSON(http.StatusOK, req)
}
