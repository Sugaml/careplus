package handlers

import (
	"net/http"
	"strconv"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type ActivityHandler struct {
	activityService inbound.ActivityLogService
	logger          *zap.Logger
}

func NewActivityHandler(activityService inbound.ActivityLogService, logger *zap.Logger) *ActivityHandler {
	return &ActivityHandler{activityService: activityService, logger: logger}
}

func (h *ActivityHandler) List(c *gin.Context) {
	pharmacyIDStr, ok := c.Get("pharmacy_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "pharmacy_id not set"})
		return
	}
	pharmacyID, err := uuid.Parse(pharmacyIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy_id"})
		return
	}
	limit := 50
	offset := 0
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
			if limit > 100 {
				limit = 100
			}
		}
	}
	if v := c.Query("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	list, err := h.activityService.ListByPharmacy(c.Request.Context(), pharmacyID, limit, offset)
	if err != nil {
		h.logger.Warn("activity list failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to list activity"})
		return
	}
	c.JSON(http.StatusOK, list)
}
