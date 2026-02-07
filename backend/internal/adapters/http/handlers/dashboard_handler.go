package handlers

import (
	"net/http"
	"time"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// DashboardStatsResponse is the JSON shape for GET /dashboard/stats.
type DashboardStatsResponse struct {
	OrdersCount        int `json:"orders_count"`
	ProductsCount      int `json:"products_count"`
	PharmacistsCount   int `json:"pharmacists_count"`
	TodayRosterCount  int `json:"today_roster_count"`
	TodayDailiesCount int `json:"today_dailies_count"`
}

type DashboardHandler struct {
	orderService      inbound.OrderService
	productService    inbound.ProductService
	userService       inbound.UserService
	dutyRosterService inbound.DutyRosterService
	dailyLogService   inbound.DailyLogService
	logger            *zap.Logger
}

func NewDashboardHandler(
	orderService inbound.OrderService,
	productService inbound.ProductService,
	userService inbound.UserService,
	dutyRosterService inbound.DutyRosterService,
	dailyLogService inbound.DailyLogService,
	logger *zap.Logger,
) *DashboardHandler {
	return &DashboardHandler{
		orderService:      orderService,
		productService:    productService,
		userService:       userService,
		dutyRosterService: dutyRosterService,
		dailyLogService:   dailyLogService,
		logger:            logger,
	}
}

// GetStats returns dashboard counts for the current user's pharmacy (orders, products; for manager also pharmacists, today's roster, today's tasks).
func (h *DashboardHandler) GetStats(c *gin.Context) {
	pharmacyIDStr, ok := c.Get("pharmacy_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "pharmacy_id not set"})
		return
	}
	role, _ := c.Get("role")
	pharmacyID, err := uuid.Parse(pharmacyIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy_id"})
		return
	}
	ctx := c.Request.Context()
	roleStr, _ := role.(string)

	resp := DashboardStatsResponse{}

	// Orders count: end users (staff) see only their order count; others see pharmacy total
	var createdBy *uuid.UUID
	if roleStr == "staff" {
		if userIDStr, ok := c.Get("user_id"); ok && userIDStr != nil {
			if uid, parseErr := uuid.Parse(userIDStr.(string)); parseErr == nil {
				createdBy = &uid
			}
		}
	}
	orders, err := h.orderService.List(ctx, pharmacyID, createdBy, nil)
	if err != nil {
		h.logger.Error("dashboard orders list failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to load dashboard stats"})
		return
	}
	resp.OrdersCount = len(orders)

	// Products count (use paginated with limit 1 to get total only)
	_, total, err := h.productService.ListPaginated(ctx, pharmacyID, nil, nil, 1, 0)
	if err != nil {
		h.logger.Error("dashboard products count failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to load dashboard stats"})
		return
	}
	resp.ProductsCount = int(total)

	// Manager-only: pharmacists, today roster, today dailies
	if roleStr == "manager" {
		users, err := h.userService.List(ctx, pharmacyID, "manager")
		if err != nil {
			h.logger.Error("dashboard users list failed", zap.Error(err))
			c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to load dashboard stats"})
			return
		}
		resp.PharmacistsCount = len(users)

		today := time.Now().Truncate(24 * time.Hour)
		roster, err := h.dutyRosterService.ListByDateRange(ctx, pharmacyID, today, today)
		if err != nil {
			h.logger.Error("dashboard duty roster list failed", zap.Error(err))
			c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to load dashboard stats"})
			return
		}
		resp.TodayRosterCount = len(roster)

		dailies, err := h.dailyLogService.ListByDate(ctx, pharmacyID, today)
		if err != nil {
			h.logger.Error("dashboard daily logs list failed", zap.Error(err))
			c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to load dashboard stats"})
			return
		}
		resp.TodayDailiesCount = len(dailies)
	}

	c.JSON(http.StatusOK, resp)
}
