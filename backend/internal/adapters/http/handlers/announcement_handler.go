package handlers

import (
	"net/http"
	"time"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type AnnouncementHandler struct {
	svc    inbound.AnnouncementService
	logger *zap.Logger
}

func NewAnnouncementHandler(svc inbound.AnnouncementService, logger *zap.Logger) *AnnouncementHandler {
	return &AnnouncementHandler{svc: svc, logger: logger}
}

func getPharmacyID(c *gin.Context) (uuid.UUID, bool) {
	v, ok := c.Get("pharmacy_id")
	if !ok {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(v.(string))
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}

func getUserID(c *gin.Context) (uuid.UUID, bool) {
	v, ok := c.Get("user_id")
	if !ok {
		return uuid.Nil, false
	}
	id, ok := v.(uuid.UUID)
	if ok {
		return id, true
	}
	if s, ok := v.(string); ok {
		parsed, err := uuid.Parse(s)
		return parsed, err == nil
	}
	return uuid.Nil, false
}

// List returns announcements for the current pharmacy (staff). Auth required.
func (h *AnnouncementHandler) List(c *gin.Context) {
	pharmacyID, ok := getPharmacyID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "pharmacy_id not set"})
		return
	}
	activeOnly := c.Query("active") == "true"
	list, err := h.svc.ListByPharmacy(c.Request.Context(), pharmacyID, activeOnly)
	if err != nil {
		h.logger.Warn("announcement list failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to list announcements"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// GetByID returns one announcement. Staff only.
func (h *AnnouncementHandler) GetByID(c *gin.Context) {
	pharmacyID, ok := getPharmacyID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "pharmacy_id not set"})
		return
	}
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid announcement id"})
		return
	}
	a, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil {
		if errors.GetAppError(err) != nil && errors.GetAppError(err).Code == errors.ErrCodeNotFound {
			c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "announcement not found"})
			return
		}
		h.logger.Warn("announcement get failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to get announcement"})
		return
	}
	if a.PharmacyID != pharmacyID {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "announcement not found"})
		return
	}
	c.JSON(http.StatusOK, a)
}

// ListActiveForUser returns announcements to show on the dashboard (not yet acked, within date range).
// Any authenticated user (including end users / staff role).
func (h *AnnouncementHandler) ListActiveForUser(c *gin.Context) {
	pharmacyID, ok := getPharmacyID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "pharmacy_id not set"})
		return
	}
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "user_id not set"})
		return
	}
	list, err := h.svc.ListActiveForUser(c.Request.Context(), pharmacyID, userID)
	if err != nil {
		h.logger.Warn("announcement list active for user failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to list announcements"})
		return
	}
	if list == nil {
		list = []*models.Announcement{}
	}
	c.JSON(http.StatusOK, list)
}

type createAnnouncementRequest struct {
	Type           string  `json:"type" binding:"required"` // offer, status, event
	Template       string  `json:"template"`                // celebration, banner, modal
	Title          string  `json:"title" binding:"required"`
	Body           string  `json:"body"`
	ImageURL       string  `json:"image_url"`
	LinkURL        string  `json:"link_url"`
	DisplaySeconds int     `json:"display_seconds"` // 1-30
	ValidDays      int     `json:"valid_days"`
	ShowTerms      bool    `json:"show_terms"`
	TermsText      string  `json:"terms_text"`
	AllowSkipAll   *bool   `json:"allow_skip_all"`
	StartAt        *string `json:"start_at"` // RFC3339
	EndAt          *string `json:"end_at"`
	SortOrder      int     `json:"sort_order"`
	IsActive       *bool   `json:"is_active"`
}

// Create creates an announcement. Staff (pharmacist, admin, manager) only.
func (h *AnnouncementHandler) Create(c *gin.Context) {
	pharmacyID, ok := getPharmacyID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "pharmacy_id not set"})
		return
	}
	var body createAnnouncementRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	if body.Type != models.AnnouncementTypeOffer && body.Type != models.AnnouncementTypeStatus && body.Type != models.AnnouncementTypeEvent {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "type must be offer, status, or event"})
		return
	}
	a := &models.Announcement{
		Type:          body.Type,
		Template:      body.Template,
		Title:         body.Title,
		Body:          body.Body,
		ImageURL:      body.ImageURL,
		LinkURL:       body.LinkURL,
		DisplaySeconds: body.DisplaySeconds,
		ValidDays:     body.ValidDays,
		ShowTerms:     body.ShowTerms,
		TermsText:     body.TermsText,
		SortOrder:     body.SortOrder,
	}
	if body.AllowSkipAll != nil {
		a.AllowSkipAll = *body.AllowSkipAll
	} else {
		a.AllowSkipAll = true
	}
	if body.IsActive != nil {
		a.IsActive = *body.IsActive
	} else {
		a.IsActive = true
	}
	if body.StartAt != nil && *body.StartAt != "" {
		t, err := time.Parse(time.RFC3339, *body.StartAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid start_at"})
			return
		}
		a.StartAt = &t
	}
	if body.EndAt != nil && *body.EndAt != "" {
		t, err := time.Parse(time.RFC3339, *body.EndAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid end_at"})
			return
		}
		a.EndAt = &t
	}
	created, err := h.svc.Create(c.Request.Context(), pharmacyID, a)
	if err != nil {
		h.logger.Warn("announcement create failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to create announcement"})
		return
	}
	c.JSON(http.StatusCreated, created)
}

// Update updates an announcement. Staff only.
func (h *AnnouncementHandler) Update(c *gin.Context) {
	pharmacyID, ok := getPharmacyID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "pharmacy_id not set"})
		return
	}
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid announcement id"})
		return
	}
	var body createAnnouncementRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	existing, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil {
		if errors.GetAppError(err) != nil && errors.GetAppError(err).Code == errors.ErrCodeNotFound {
			c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "announcement not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to get announcement"})
		return
	}
	if existing.PharmacyID != pharmacyID {
		c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "announcement not found"})
		return
	}
	a := &models.Announcement{
		ID:             id,
		Type:           body.Type,
		Template:       body.Template,
		Title:          body.Title,
		Body:           body.Body,
		ImageURL:       body.ImageURL,
		LinkURL:        body.LinkURL,
		DisplaySeconds: body.DisplaySeconds,
		ValidDays:      body.ValidDays,
		ShowTerms:      body.ShowTerms,
		TermsText:      body.TermsText,
		SortOrder:      body.SortOrder,
		StartAt:        existing.StartAt,
		EndAt:          existing.EndAt,
	}
	if body.Type == "" {
		a.Type = existing.Type
	}
	if body.Template == "" {
		a.Template = existing.Template
	}
	if body.Title == "" {
		a.Title = existing.Title
	}
	if body.Body == "" {
		a.Body = existing.Body
	}
	if body.ImageURL == "" {
		a.ImageURL = existing.ImageURL
	}
	if body.LinkURL == "" {
		a.LinkURL = existing.LinkURL
	}
	if body.DisplaySeconds > 0 {
		a.DisplaySeconds = body.DisplaySeconds
	} else {
		a.DisplaySeconds = existing.DisplaySeconds
	}
	if body.ValidDays > 0 {
		a.ValidDays = body.ValidDays
	} else {
		a.ValidDays = existing.ValidDays
	}
	if body.AllowSkipAll != nil {
		a.AllowSkipAll = *body.AllowSkipAll
	} else {
		a.AllowSkipAll = existing.AllowSkipAll
	}
	if body.IsActive != nil {
		a.IsActive = *body.IsActive
	} else {
		a.IsActive = existing.IsActive
	}
	if body.StartAt != nil && *body.StartAt != "" {
		t, err := time.Parse(time.RFC3339, *body.StartAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid start_at"})
			return
		}
		a.StartAt = &t
	}
	if body.EndAt != nil && *body.EndAt != "" {
		t, err := time.Parse(time.RFC3339, *body.EndAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid end_at"})
			return
		}
		a.EndAt = &t
	}
	updated, err := h.svc.Update(c.Request.Context(), pharmacyID, a)
	if err != nil {
		if errors.GetAppError(err) != nil && errors.GetAppError(err).Code == errors.ErrCodeNotFound {
			c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "announcement not found"})
			return
		}
		h.logger.Warn("announcement update failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to update announcement"})
		return
	}
	c.JSON(http.StatusOK, updated)
}

// Delete deletes an announcement. Staff only.
func (h *AnnouncementHandler) Delete(c *gin.Context) {
	pharmacyID, ok := getPharmacyID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "pharmacy_id not set"})
		return
	}
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid announcement id"})
		return
	}
	if err := h.svc.Delete(c.Request.Context(), pharmacyID, id); err != nil {
		if errors.GetAppError(err) != nil && errors.GetAppError(err).Code == errors.ErrCodeNotFound {
			c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "announcement not found"})
			return
		}
		h.logger.Warn("announcement delete failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to delete announcement"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

type ackRequest struct {
	SkipAll bool `json:"skip_all"`
}

// Acknowledge records that the user dismissed an announcement or chose "skip all".
// POST /announcements/:id/ack with body { "skip_all": false } to dismiss one.
// For "skip all", frontend can call POST /announcements/skip-all (no id).
func (h *AnnouncementHandler) Acknowledge(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "user_id not set"})
		return
	}
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid announcement id"})
		return
	}
	var body ackRequest
	_ = c.ShouldBindJSON(&body)
	if err := h.svc.Acknowledge(c.Request.Context(), userID, id, body.SkipAll); err != nil {
		h.logger.Warn("announcement ack failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to acknowledge"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

// SkipAll records that the user chose "skip all" (no specific announcement id).
func (h *AnnouncementHandler) SkipAll(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "user_id not set"})
		return
	}
	// Use nil UUID to indicate skip-all; service expects announcementID for single ack. So we need to call Acknowledge with skipAll=true and a dummy ID or change service. Service Acknowledge(userID, announcementID, skipAll): if skipAll, announcementID is not used and we store nil. So we can pass uuid.Nil for announcementID when skipAll is true.
	if err := h.svc.Acknowledge(c.Request.Context(), userID, uuid.Nil, true); err != nil {
		h.logger.Warn("announcement skip-all failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to skip all"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}
