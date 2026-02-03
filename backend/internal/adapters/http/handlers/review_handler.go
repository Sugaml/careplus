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

type ReviewHandler struct {
	reviewService inbound.ReviewService
	logger        *zap.Logger
}

func NewReviewHandler(reviewService inbound.ReviewService, logger *zap.Logger) *ReviewHandler {
	return &ReviewHandler{reviewService: reviewService, logger: logger}
}

// ListByProductID returns reviews for a product (public or auth; auth gets user_liked).
func (h *ReviewHandler) ListByProductID(c *gin.Context) {
	productIDStr := c.Param("productId")
	if productIDStr == "" {
		productIDStr = c.Param("id")
	}
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid product id"})
		return
	}
	var userID *uuid.UUID
	if uidStr, ok := c.Get("user_id"); ok && uidStr != nil {
		if uid, e := uuid.Parse(uidStr.(string)); e == nil {
			userID = &uid
		}
	}
	limit, offset := 20, 0
	if l := c.Query("limit"); l != "" {
		if n, ok := parseInt(l); ok && n > 0 && n <= 100 {
			limit = n
		}
	}
	if o := c.Query("offset"); o != "" {
		if n, ok := parseInt(o); ok && n >= 0 {
			offset = n
		}
	}
	list, err := h.reviewService.ListByProductID(c.Request.Context(), productID, userID, limit, offset)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

// Create creates a review for a product (auth required).
func (h *ReviewHandler) Create(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	productIDStr := c.Param("productId")
	if productIDStr == "" {
		productIDStr = c.Param("id")
	}
	productID, err := uuid.Parse(productIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid product id"})
		return
	}
	var body struct {
		Rating int    `json:"rating" binding:"required,min=1,max=5"`
		Title  string `json:"title"`
		Body   string `json:"body"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	rev, err := h.reviewService.Create(c.Request.Context(), userID, productID, body.Rating, body.Title, body.Body)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, rev)
}

// GetByID returns one review with like count and user_liked (auth optional).
func (h *ReviewHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	var userID *uuid.UUID
	if uidStr, ok := c.Get("user_id"); ok && uidStr != nil {
		if uid, e := uuid.Parse(uidStr.(string)); e == nil {
			userID = &uid
		}
	}
	meta, err := h.reviewService.GetByID(c.Request.Context(), id, userID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, meta)
}

// Update updates own review.
func (h *ReviewHandler) Update(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	var body struct {
		Rating *int   `json:"rating"`
		Title  *string `json:"title"`
		Body   *string `json:"body"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	rev, err := h.reviewService.Update(c.Request.Context(), id, userID, body.Rating, body.Title, body.Body)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, rev)
}

// Delete deletes own review.
func (h *ReviewHandler) Delete(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	if err := h.reviewService.Delete(c.Request.Context(), id, userID); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// Like likes a review (idempotent).
func (h *ReviewHandler) Like(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	if err := h.reviewService.Like(c.Request.Context(), id, userID); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "liked"})
}

// Unlike removes like.
func (h *ReviewHandler) Unlike(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	if err := h.reviewService.Unlike(c.Request.Context(), id, userID); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unliked"})
}

// ListComments returns comments for a review.
func (h *ReviewHandler) ListComments(c *gin.Context) {
	reviewID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	limit, offset := 50, 0
	if l := c.Query("limit"); l != "" {
		if n, ok := parseInt(l); ok && n > 0 && n <= 100 {
			limit = n
		}
	}
	if o := c.Query("offset"); o != "" {
		if n, ok := parseInt(o); ok && n >= 0 {
			offset = n
		}
	}
	list, err := h.reviewService.ListComments(c.Request.Context(), reviewID, limit, offset)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateComment adds a comment to a review.
func (h *ReviewHandler) CreateComment(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	reviewID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	var body struct {
		Body     string  `json:"body" binding:"required"`
		ParentID *string `json:"parent_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	var parentID *uuid.UUID
	if body.ParentID != nil && *body.ParentID != "" {
		if pid, e := uuid.Parse(*body.ParentID); e == nil {
			parentID = &pid
		}
	}
	comment, err := h.reviewService.CreateComment(c.Request.Context(), reviewID, userID, body.Body, parentID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	// Preload user for response
	c.JSON(http.StatusCreated, comment)
}

// DeleteComment deletes own comment.
func (h *ReviewHandler) DeleteComment(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	if err := h.reviewService.DeleteComment(c.Request.Context(), id, userID); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func parseInt(s string) (int, bool) {
	n, err := strconv.Atoi(s)
	return n, err == nil
}
