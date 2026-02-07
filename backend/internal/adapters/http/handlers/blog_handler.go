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

type BlogHandler struct {
	blogService inbound.BlogService
	logger      *zap.Logger
}

func NewBlogHandler(blogService inbound.BlogService, logger *zap.Logger) *BlogHandler {
	return &BlogHandler{blogService: blogService, logger: logger}
}

// ListCategories returns blog categories (optional parent_id for submenu).
func (h *BlogHandler) ListCategories(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var parentID *uuid.UUID
	if p := c.Query("parent_id"); p != "" {
		if pid, err := uuid.Parse(p); err == nil {
			parentID = &pid
		}
	}
	list, err := h.blogService.ListCategories(c.Request.Context(), pharmacyID, parentID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateCategory creates a blog category (staff).
func (h *BlogHandler) CreateCategory(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var body struct {
		Name        string     `json:"name" binding:"required"`
		Description string     `json:"description"`
		ParentID    *uuid.UUID `json:"parent_id"`
		SortOrder   int        `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	cat, err := h.blogService.CreateCategory(c.Request.Context(), pharmacyID, body.Name, body.Description, body.ParentID, body.SortOrder)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, cat)
}

// GetCategory returns one category.
func (h *BlogHandler) GetCategory(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	cat, err := h.blogService.GetCategory(c.Request.Context(), id)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, cat)
}

// UpdateCategory updates a category (staff).
func (h *BlogHandler) UpdateCategory(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	var body struct {
		Name        *string    `json:"name"`
		Description *string    `json:"description"`
		ParentID    *uuid.UUID `json:"parent_id"`
		SortOrder   *int       `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	cat, err := h.blogService.UpdateCategory(c.Request.Context(), pharmacyID, id, body.Name, body.Description, body.ParentID, body.SortOrder)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, cat)
}

// DeleteCategory deletes a category (staff).
func (h *BlogHandler) DeleteCategory(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	if err := h.blogService.DeleteCategory(c.Request.Context(), pharmacyID, id); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ListPostsPublic returns published blog posts for a pharmacy (no auth; for public store).
func (h *BlogHandler) ListPostsPublic(c *gin.Context) {
	pharmacyIDStr := c.Param("pharmacyId")
	if pharmacyIDStr == "" {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "missing pharmacy id"})
		return
	}
	pharmacyID, err := uuid.Parse(pharmacyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy id"})
		return
	}
	status := models.BlogPostStatusPublished
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
	var categoryID *uuid.UUID
	if cat := c.Query("category_id"); cat != "" {
		if cid, err := uuid.Parse(cat); err == nil {
			categoryID = &cid
		}
	}
	list, total, err := h.blogService.ListPosts(c.Request.Context(), pharmacyID, &status, categoryID, limit, offset)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"posts": list, "total": total})
}

// GetPostBySlugPublic returns a published post by slug for a pharmacy (no auth).
func (h *BlogHandler) GetPostBySlugPublic(c *gin.Context) {
	pharmacyIDStr := c.Param("pharmacyId")
	slug := c.Param("slug")
	if pharmacyIDStr == "" || slug == "" {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "missing pharmacy id or slug"})
		return
	}
	pharmacyID, err := uuid.Parse(pharmacyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy id"})
		return
	}
	post, err := h.blogService.GetPostBySlug(c.Request.Context(), pharmacyID, slug, nil, true)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	if post.Status != models.BlogPostStatusPublished {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "post not found"})
		return
	}
	c.JSON(http.StatusOK, post)
}

// ListPosts returns blog posts (optional status, category_id; for staff can list draft/pending).
func (h *BlogHandler) ListPosts(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	status := c.Query("status")
	if status == "" {
		status = models.BlogPostStatusPublished
	}
	var statusPtr *string
	if status != "" {
		statusPtr = &status
	}
	var categoryID *uuid.UUID
	if cat := c.Query("category_id"); cat != "" {
		if cid, err := uuid.Parse(cat); err == nil {
			categoryID = &cid
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
	list, total, err := h.blogService.ListPosts(c.Request.Context(), pharmacyID, statusPtr, categoryID, limit, offset)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"posts": list, "total": total})
}

// ListPendingPosts returns posts pending approval (manager/admin).
func (h *BlogHandler) ListPendingPosts(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	limit, offset := 50, 0
	if l := c.Query("limit"); l != "" {
		if n, ok := parseInt(l); ok && n > 0 {
			limit = n
		}
	}
	if o := c.Query("offset"); o != "" {
		if n, ok := parseInt(o); ok && n >= 0 {
			offset = n
		}
	}
	list, total, err := h.blogService.ListPendingPosts(c.Request.Context(), pharmacyID, limit, offset)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"posts": list, "total": total})
}

// CreatePost creates a blog post (staff: draft or pending_approval).
func (h *BlogHandler) CreatePost(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	userIDStr, _ := c.Get("user_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	authorID, _ := uuid.Parse(userIDStr.(string))
	var body struct {
		Title      string                      `json:"title" binding:"required"`
		Excerpt    string                      `json:"excerpt"`
		Body       string                      `json:"body" binding:"required"`
		CategoryID *uuid.UUID                  `json:"category_id"`
		Status     string                      `json:"status"`
		Media      []inbound.BlogPostMediaInput `json:"media"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	if body.Status != models.BlogPostStatusDraft && body.Status != models.BlogPostStatusPendingApproval {
		body.Status = models.BlogPostStatusDraft
	}
	post, err := h.blogService.CreatePost(c.Request.Context(), pharmacyID, authorID, body.Title, body.Excerpt, body.Body, body.CategoryID, body.Status, body.Media)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, post)
}

// GetPost returns a single post with meta (views, likes, comments, media). Optionally records view.
func (h *BlogHandler) GetPost(c *gin.Context) {
	postID, err := uuid.Parse(c.Param("id"))
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
	recordView := c.Query("record_view") != "false"
	post, err := h.blogService.GetPost(c.Request.Context(), postID, userID, recordView)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, post)
}

// UpdatePost updates a draft or pending post (author only).
func (h *BlogHandler) UpdatePost(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	userIDStr, _ := c.Get("user_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	userID, _ := uuid.Parse(userIDStr.(string))
	postID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	var body struct {
		Title      *string                     `json:"title"`
		Excerpt    *string                     `json:"excerpt"`
		Body       *string                     `json:"body"`
		CategoryID *uuid.UUID                  `json:"category_id"`
		Status     *string                     `json:"status"`
		Media      []inbound.BlogPostMediaInput `json:"media"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	post, err := h.blogService.UpdatePost(c.Request.Context(), pharmacyID, userID, postID, body.Title, body.Excerpt, body.Body, body.CategoryID, body.Status, body.Media)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, post)
}

// DeletePost deletes a draft or pending post (author only).
func (h *BlogHandler) DeletePost(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	userIDStr, _ := c.Get("user_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	userID, _ := uuid.Parse(userIDStr.(string))
	postID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	if err := h.blogService.DeletePost(c.Request.Context(), pharmacyID, userID, postID); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ApprovePost sets post status to published (manager/admin).
func (h *BlogHandler) ApprovePost(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	postID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	post, err := h.blogService.ApprovePost(c.Request.Context(), pharmacyID, postID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, post)
}

// SubmitForApproval sets draft to pending_approval (author).
func (h *BlogHandler) SubmitForApproval(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	userIDStr, _ := c.Get("user_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	userID, _ := uuid.Parse(userIDStr.(string))
	postID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	post, err := h.blogService.SubmitForApproval(c.Request.Context(), pharmacyID, userID, postID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, post)
}

// LikePost likes a published post.
func (h *BlogHandler) LikePost(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	postID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	if err := h.blogService.LikePost(c.Request.Context(), postID, userID); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "liked"})
}

// UnlikePost removes like.
func (h *BlogHandler) UnlikePost(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	postID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	if err := h.blogService.UnlikePost(c.Request.Context(), postID, userID); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "unliked"})
}

// ListComments returns comments for a post.
func (h *BlogHandler) ListComments(c *gin.Context) {
	postID, err := uuid.Parse(c.Param("id"))
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
	list, err := h.blogService.ListComments(c.Request.Context(), postID, limit, offset)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateComment adds a comment (auth required).
func (h *BlogHandler) CreateComment(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	postID, err := uuid.Parse(c.Param("id"))
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
	comment, err := h.blogService.CreateComment(c.Request.Context(), postID, userID, body.Body, parentID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, comment)
}

// DeleteComment deletes own comment.
func (h *BlogHandler) DeleteComment(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	if err := h.blogService.DeleteComment(c.Request.Context(), id, userID); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// RecordView records a view for analytics (optional; GetPost already records when record_view=true).
func (h *BlogHandler) RecordView(c *gin.Context) {
	postID, err := uuid.Parse(c.Param("id"))
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
	if err := h.blogService.RecordView(c.Request.Context(), postID, userID); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "recorded"})
}

// GetPostAnalytics returns analytics for one post (staff).
func (h *BlogHandler) GetPostAnalytics(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	postID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	a, err := h.blogService.GetPostAnalytics(c.Request.Context(), pharmacyID, postID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, a)
}

// GetAnalytics returns analytics for all published posts (staff).
func (h *BlogHandler) GetAnalytics(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	limit := 50
	if l := c.Query("limit"); l != "" {
		if n, ok := parseInt(l); ok && n > 0 && n <= 200 {
			limit = n
		}
	}
	list, err := h.blogService.GetAnalytics(c.Request.Context(), pharmacyID, limit)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"analytics": list})
}
