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

type NotificationHandler struct {
	notificationService inbound.NotificationService
	logger              *zap.Logger
}

func NewNotificationHandler(notificationService inbound.NotificationService, logger *zap.Logger) *NotificationHandler {
	return &NotificationHandler{notificationService: notificationService, logger: logger}
}

func (h *NotificationHandler) List(c *gin.Context) {
	userIDStr, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "user_id not set"})
		return
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid user_id"})
		return
	}
	limit := 50
	offset := 0
	unreadOnly := false
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
	if v := c.Query("unread_only"); v == "true" || v == "1" {
		unreadOnly = true
	}
	list, err := h.notificationService.ListByUser(c.Request.Context(), userID, unreadOnly, limit, offset)
	if err != nil {
		h.logger.Warn("notification list failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to list notifications"})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *NotificationHandler) CountUnread(c *gin.Context) {
	userIDStr, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "user_id not set"})
		return
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid user_id"})
		return
	}
	count, err := h.notificationService.CountUnreadByUser(c.Request.Context(), userID)
	if err != nil {
		h.logger.Warn("notification count unread failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to count unread"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	userIDStr, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "user_id not set"})
		return
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid user_id"})
		return
	}
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid notification id"})
		return
	}
	if err := h.notificationService.MarkRead(c.Request.Context(), id, userID); err != nil {
		h.logger.Warn("notification mark read failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to mark as read"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "marked as read"})
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	userIDStr, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "user_id not set"})
		return
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid user_id"})
		return
	}
	if err := h.notificationService.MarkAllRead(c.Request.Context(), userID); err != nil {
		h.logger.Warn("notification mark all read failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to mark all as read"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "all marked as read"})
}

type createNotificationRequest struct {
	UserID  string `json:"user_id" binding:"required"`
	Title   string `json:"title" binding:"required"`
	Message string `json:"message"`
	Type    string `json:"type"`
}

func (h *NotificationHandler) Create(c *gin.Context) {
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
	var body createNotificationRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	userID, err := uuid.Parse(body.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid user_id"})
		return
	}
	notifType := body.Type
	if notifType == "" {
		notifType = "info"
	}
	n, err := h.notificationService.Create(c.Request.Context(), pharmacyID, userID, body.Title, body.Message, notifType)
	if err != nil {
		h.logger.Warn("notification create failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to create notification"})
		return
	}
	c.JSON(http.StatusCreated, n)
}
