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

type ReferralHandler struct {
	referralPointsSvc inbound.ReferralPointsService
	logger            *zap.Logger
}

func NewReferralHandler(referralPointsSvc inbound.ReferralPointsService, logger *zap.Logger) *ReferralHandler {
	return &ReferralHandler{referralPointsSvc: referralPointsSvc, logger: logger}
}

// ValidateReferralCode (public) validates a referral code for a pharmacy.
func (h *ReferralHandler) ValidateReferralCode(c *gin.Context) {
	pharmacyIDStr := c.Param("pharmacyId")
	pharmacyID, err := uuid.Parse(pharmacyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy id"})
		return
	}
	code := c.Query("code")
	result, err := h.referralPointsSvc.ValidateReferralCode(c.Request.Context(), pharmacyID, code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// GetConfig returns referral points config for the current pharmacy (get-or-create with defaults).
func (h *ReferralHandler) GetConfig(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	cfg, err := h.referralPointsSvc.GetOrCreateConfig(c.Request.Context(), pharmacyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

// UpsertConfig (admin) upserts referral points config for the current pharmacy.
func (h *ReferralHandler) UpsertConfig(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var body struct {
		PointsPerCurrencyUnit   float64 `json:"points_per_currency_unit"`
		CurrencyUnitForPoints   float64 `json:"currency_unit_for_points"`
		ReferralRewardPoints    int     `json:"referral_reward_points"`
		RedemptionRatePoints    int     `json:"redemption_rate_points"`
		RedemptionRateCurrency  float64 `json:"redemption_rate_currency"`
		MaxRedeemPointsPerOrder int     `json:"max_redeem_points_per_order"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	cfg, err := h.referralPointsSvc.UpsertConfig(c.Request.Context(), pharmacyID, &models.ReferralPointsConfig{
		PharmacyID:                pharmacyID,
		PointsPerCurrencyUnit:     body.PointsPerCurrencyUnit,
		CurrencyUnitForPoints:     body.CurrencyUnitForPoints,
		ReferralRewardPoints:      body.ReferralRewardPoints,
		RedemptionRatePoints:      body.RedemptionRatePoints,
		RedemptionRateCurrency:    body.RedemptionRateCurrency,
		MaxRedeemPointsPerOrder:   body.MaxRedeemPointsPerOrder,
	})
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, cfg)
}

// ListCustomers returns paginated customers for the current pharmacy.
func (h *ReferralHandler) ListCustomers(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	list, total, err := h.referralPointsSvc.ListCustomers(c.Request.Context(), pharmacyID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list, "total": total})
}

// GetCustomerByPhone returns a customer by phone for the current pharmacy, with optional membership (id, name).
func (h *ReferralHandler) GetCustomerByPhone(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	phone := c.Query("phone")
	if phone == "" {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "phone is required"})
		return
	}
	cust, err := h.referralPointsSvc.GetCustomerByPhoneWithMembership(c.Request.Context(), pharmacyID, phone)
	if err != nil || cust == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "customer not found"})
		return
	}
	c.JSON(http.StatusOK, cust)
}

// ListPointsTransactions returns points transaction history for a customer.
func (h *ReferralHandler) ListPointsTransactions(c *gin.Context) {
	customerIDStr := c.Param("customerId")
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid customer id"})
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	list, err := h.referralPointsSvc.ListPointsTransactions(c.Request.Context(), customerID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// GetMyCustomerProfile returns the customer profile for the logged-in user (end-user profile: referral code, points, membership, earned from purchases).
func (h *ReferralHandler) GetMyCustomerProfile(c *gin.Context) {
	userIDStr, ok := c.Get("user_id")
	if !ok || userIDStr == nil {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "user_id required"})
		return
	}
	pharmacyIDStr, ok := c.Get("pharmacy_id")
	if !ok || pharmacyIDStr == nil {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "pharmacy_id required"})
		return
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid user_id"})
		return
	}
	pharmacyID, err := uuid.Parse(pharmacyIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy_id"})
		return
	}
	resp, err := h.referralPointsSvc.GetMyCustomerProfile(c.Request.Context(), userID, pharmacyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// ComputeRedeemPreview returns the discount and max redeemable for a customer and subtotal (for checkout UI).
func (h *ReferralHandler) ComputeRedeemPreview(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	customerIDStr := c.Query("customer_id")
	if customerIDStr == "" {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "customer_id is required"})
		return
	}
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid customer_id"})
		return
	}
	pointsStr := c.Query("points_to_redeem")
	pointsToRedeem := 0
	if pointsStr != "" {
		pointsToRedeem, _ = strconv.Atoi(pointsStr)
	}
	subTotalStr := c.Query("sub_total")
	subTotal := 0.0
	if subTotalStr != "" {
		subTotal, _ = strconv.ParseFloat(subTotalStr, 64)
	}
	result, err := h.referralPointsSvc.ComputeRedeemDiscount(c.Request.Context(), pharmacyID, customerID, pointsToRedeem, subTotal)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}
