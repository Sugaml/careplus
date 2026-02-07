package handlers

import (
	"net/http"
	"strconv"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type ChatHandler struct {
	chatService  inbound.ChatService
	authProvider outbound.AuthProvider
	logger       *zap.Logger
}

func NewChatHandler(chatService inbound.ChatService, authProvider outbound.AuthProvider, logger *zap.Logger) *ChatHandler {
	return &ChatHandler{chatService: chatService, authProvider: authProvider, logger: logger}
}

func (h *ChatHandler) getChatContext(c *gin.Context) (pharmacyID uuid.UUID, userID *uuid.UUID, customerID *uuid.UUID, role string, isCustomer bool, ok bool) {
	pid, _ := c.Get("pharmacy_id")
	pharmacyID, err := uuid.Parse(pid.(string))
	if err != nil {
		return uuid.Nil, nil, nil, "", false, false
	}
	isCustomerVal, _ := c.Get("chat_customer")
	isCustomer = isCustomerVal.(bool)
	if isCustomer {
		cid, _ := c.Get("customer_id")
		cidParsed, _ := uuid.Parse(cid.(string))
		customerID = &cidParsed
		return pharmacyID, nil, customerID, "", true, true
	}
	uid, _ := c.Get("user_id")
	uidParsed, _ := uuid.Parse(uid.(string))
	userID = &uidParsed
	if r, _ := c.Get("role"); r != nil {
		role = r.(string)
	}
	return pharmacyID, userID, nil, role, false, true
}

// GetChatSettings - returns chat-related settings (e.g. edit window) for the current pharmacy
func (h *ChatHandler) GetChatSettings(c *gin.Context) {
	pharmacyID, _, _, _, _, ok := h.getChatContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "invalid context"})
		return
	}
	editWindow := h.chatService.GetChatEditWindowMinutes(c.Request.Context(), pharmacyID)
	c.JSON(http.StatusOK, gin.H{"chat_edit_window_minutes": editWindow})
}

// ListConversations - list conversations: for role "staff" (end user) only their own; for admin/manager/pharmacist all pharmacy conversations
func (h *ChatHandler) ListConversations(c *gin.Context) {
	pharmacyID, userID, _, role, isCustomer, ok := h.getChatContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "invalid context"})
		return
	}
	if isCustomer {
		c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "customers cannot list conversations"})
		return
	}
	limit, offset := 20, 0
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
	var filterUserID *uuid.UUID
	if role == "staff" && userID != nil {
		filterUserID = userID
	}
	list, total, err := h.chatService.ListConversations(c.Request.Context(), pharmacyID, filterUserID, limit, offset)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list, "total": total})
}

type createConversationRequest struct {
	CustomerID string `json:"customer_id" binding:"required"`
}

// CreateConversation (staff only) - get or create conversation with customer
func (h *ChatHandler) CreateConversation(c *gin.Context) {
	pharmacyID, _, _, _, isCustomer, ok := h.getChatContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "invalid context"})
		return
	}
	if isCustomer {
		c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "customers cannot create conversations"})
		return
	}
	var req createConversationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	customerID, err := uuid.Parse(req.CustomerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid customer_id"})
		return
	}
	conv, err := h.chatService.GetOrCreateConversation(c.Request.Context(), pharmacyID, customerID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, conv)
}

// GetMyConversation - customer (from token): return their conversation; staff (end user): get-or-create their single conversation
func (h *ChatHandler) GetMyConversation(c *gin.Context) {
	pharmacyID, userID, customerID, role, isCustomer, ok := h.getChatContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "invalid context"})
		return
	}
	if isCustomer && customerID != nil {
		conv, err := h.chatService.GetConversationByPharmacyAndCustomer(c.Request.Context(), pharmacyID, *customerID)
		if err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, conv)
		return
	}
	if role == "staff" && userID != nil {
		conv, err := h.chatService.GetOrCreateConversationForUser(c.Request.Context(), pharmacyID, *userID)
		if err != nil {
			writeServiceError(c, err)
			return
		}
		c.JSON(http.StatusOK, conv)
		return
	}
	c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "forbidden"})
}

// GetConversation - get one conversation (staff or customer with access)
func (h *ChatHandler) GetConversation(c *gin.Context) {
	pharmacyID, userID, customerID, role, _, ok := h.getChatContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "invalid context"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	conv, err := h.chatService.GetConversationByID(c.Request.Context(), id, pharmacyID, customerID, userID, role)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, conv)
}

// ListMessages - list messages for conversation (staff or customer with access)
func (h *ChatHandler) ListMessages(c *gin.Context) {
	pharmacyID, userID, customerID, role, _, ok := h.getChatContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "invalid context"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	limit, offset := 50, 0
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
	list, total, err := h.chatService.ListMessages(c.Request.Context(), id, pharmacyID, customerID, userID, role, limit, offset)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": list, "total": total})
}

type sendMessageRequest struct {
	Body           string `json:"body"`
	AttachmentURL  string `json:"attachment_url"`
	AttachmentName string `json:"attachment_name"`
	AttachmentType string `json:"attachment_type"`
}

// SendMessage - send a message (staff or customer)
func (h *ChatHandler) SendMessage(c *gin.Context) {
	_, userID, customerID, _, isCustomer, ok := h.getChatContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "invalid context"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	var req sendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	var senderType string
	var senderID uuid.UUID
	if isCustomer {
		senderType = models.SenderTypeCustomer
		senderID = *customerID
	} else {
		senderType = models.SenderTypeUser
		senderID = *userID
	}
	msg, err := h.chatService.SendMessage(c.Request.Context(), id, senderType, senderID, req.Body, req.AttachmentURL, req.AttachmentName, req.AttachmentType)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, msg)
}

type issueCustomerTokenRequest struct {
	CustomerID string `json:"customer_id" binding:"required"`
}

// IssueCustomerToken (staff only) - issue short-lived chat token for customer link
func (h *ChatHandler) IssueCustomerToken(c *gin.Context) {
	pharmacyID, _, _, _, isCustomer, ok := h.getChatContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "invalid context"})
		return
	}
	if isCustomer {
		c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "customers cannot issue tokens"})
		return
	}
	var req issueCustomerTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	customerID, err := uuid.Parse(req.CustomerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid customer_id"})
		return
	}
	// Verify customer belongs to pharmacy by getting conversation
	_, err = h.chatService.GetOrCreateConversation(c.Request.Context(), pharmacyID, customerID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	token, err := h.authProvider.GenerateChatCustomerToken(pharmacyID, customerID)
	if err != nil {
		h.logger.Warn("generate chat token failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to generate token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token})
}

type editMessageRequest struct {
	Body string `json:"body" binding:"required"`
}

// EditMessage - edit own message within configured time window (staff or customer)
func (h *ChatHandler) EditMessage(c *gin.Context) {
	pharmacyID, userID, customerID, role, _, ok := h.getChatContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "invalid context"})
		return
	}
	convID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid conversation id"})
		return
	}
	msgID, err := uuid.Parse(c.Param("messageId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid message id"})
		return
	}
	var req editMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	msg, err := h.chatService.EditMessage(c.Request.Context(), convID, msgID, pharmacyID, customerID, userID, role, req.Body)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, msg)
}

// DeleteMessage - delete own message (staff or customer)
func (h *ChatHandler) DeleteMessage(c *gin.Context) {
	pharmacyID, userID, customerID, role, _, ok := h.getChatContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "invalid context"})
		return
	}
	convID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid conversation id"})
		return
	}
	msgID, err := uuid.Parse(c.Param("messageId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid message id"})
		return
	}
	if err := h.chatService.DeleteMessage(c.Request.Context(), convID, msgID, pharmacyID, customerID, userID, role); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// DeleteConversation - delete own conversation and all its messages (staff or customer)
func (h *ChatHandler) DeleteConversation(c *gin.Context) {
	pharmacyID, userID, customerID, role, _, ok := h.getChatContext(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "invalid context"})
		return
	}
	convID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid conversation id"})
		return
	}
	if err := h.chatService.DeleteConversation(c.Request.Context(), convID, pharmacyID, customerID, userID, role); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusNoContent, nil)
}
