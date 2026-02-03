package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type PromoHandler struct {
	promoSvc inbound.PromoService
	logger   *zap.Logger
}

func NewPromoHandler(promoSvc inbound.PromoService, logger *zap.Logger) *PromoHandler {
	return &PromoHandler{promoSvc: promoSvc, logger: logger}
}

// ListPublic returns active promos for a pharmacy (offers, announcements, events). No auth.
func (h *PromoHandler) ListPublic(c *gin.Context) {
	pharmacyIDStr := c.Param("pharmacyId")
	pharmacyID, err := uuid.Parse(pharmacyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy id"})
		return
	}
	var types []string
	if t := c.Query("type"); t != "" {
		for _, s := range strings.Split(t, ",") {
			s = strings.TrimSpace(s)
			if s != "" && (s == models.PromoTypeOffer || s == models.PromoTypeAnnouncement || s == models.PromoTypeEvent) {
				types = append(types, s)
			}
		}
	}
	list, err := h.promoSvc.ListByPharmacy(c.Request.Context(), pharmacyID, types, true)
	if err != nil {
		h.logger.Warn("promo list public failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to list promos"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// List returns all promos for the current pharmacy (admin). Auth required.
func (h *PromoHandler) List(c *gin.Context) {
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
	var types []string
	if t := c.Query("type"); t != "" {
		for _, s := range strings.Split(t, ",") {
			s = strings.TrimSpace(s)
			if s != "" {
				types = append(types, s)
			}
		}
	}
	list, err := h.promoSvc.ListByPharmacy(c.Request.Context(), pharmacyID, types, false)
	if err != nil {
		h.logger.Warn("promo list failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to list promos"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// GetByID returns one promo. Auth required.
func (h *PromoHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid promo id"})
		return
	}
	p, err := h.promoSvc.GetByID(c.Request.Context(), id)
	if err != nil {
		if errors.GetAppError(err) != nil && errors.GetAppError(err).Code == errors.ErrCodeNotFound {
			c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "promo not found"})
			return
		}
		h.logger.Warn("promo get failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to get promo"})
		return
	}
	c.JSON(http.StatusOK, p)
}

type createPromoRequest struct {
	Type        string  `json:"type" binding:"required"` // offer, announcement, event
	Title       string  `json:"title" binding:"required"`
	Description string  `json:"description"`
	ImageURL    string  `json:"image_url"`
	LinkURL     string  `json:"link_url"`
	StartAt     *string `json:"start_at"` // RFC3339
	EndAt       *string `json:"end_at"`
	SortOrder   int     `json:"sort_order"`
	IsActive    *bool   `json:"is_active"`
}

// Create creates a promo. Admin only.
func (h *PromoHandler) Create(c *gin.Context) {
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
	var body createPromoRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	if body.Type != models.PromoTypeOffer && body.Type != models.PromoTypeAnnouncement && body.Type != models.PromoTypeEvent {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "type must be offer, announcement, or event"})
		return
	}
	p := &models.Promo{
		Type:        body.Type,
		Title:       body.Title,
		Description: body.Description,
		ImageURL:    body.ImageURL,
		LinkURL:     body.LinkURL,
		SortOrder:   body.SortOrder,
	}
	if body.IsActive != nil {
		p.IsActive = *body.IsActive
	} else {
		p.IsActive = true
	}
	if body.StartAt != nil && *body.StartAt != "" {
		t, err := parseTime(*body.StartAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid start_at"})
			return
		}
		p.StartAt = &t
	}
	if body.EndAt != nil && *body.EndAt != "" {
		t, err := parseTime(*body.EndAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid end_at"})
			return
		}
		p.EndAt = &t
	}
	created, err := h.promoSvc.Create(c.Request.Context(), pharmacyID, p)
	if err != nil {
		h.logger.Warn("promo create failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to create promo"})
		return
	}
	c.JSON(http.StatusCreated, created)
}

// Update updates a promo. Admin only.
func (h *PromoHandler) Update(c *gin.Context) {
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
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid promo id"})
		return
	}
	var body createPromoRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	if body.Type != "" && body.Type != models.PromoTypeOffer && body.Type != models.PromoTypeAnnouncement && body.Type != models.PromoTypeEvent {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "type must be offer, announcement, or event"})
		return
	}
	existing, err := h.promoSvc.GetByID(c.Request.Context(), id)
	if err != nil {
		if errors.GetAppError(err) != nil && errors.GetAppError(err).Code == errors.ErrCodeNotFound {
			c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "promo not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to get promo"})
		return
	}
	if existing.PharmacyID != pharmacyID {
		c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "promo not found"})
		return
	}
	p := &models.Promo{
		ID:          id,
		PharmacyID:  pharmacyID,
		Type:        body.Type,
		Title:       body.Title,
		Description: body.Description,
		ImageURL:    body.ImageURL,
		LinkURL:     body.LinkURL,
		SortOrder:   body.SortOrder,
		CreatedAt:   existing.CreatedAt,
	}
	if body.Type == "" {
		p.Type = existing.Type
	}
	if body.Title == "" {
		p.Title = existing.Title
	}
	if body.Description == "" {
		p.Description = existing.Description
	}
	if body.ImageURL == "" {
		p.ImageURL = existing.ImageURL
	}
	if body.LinkURL == "" {
		p.LinkURL = existing.LinkURL
	}
	p.StartAt = existing.StartAt
	p.EndAt = existing.EndAt
	if body.StartAt != nil && *body.StartAt != "" {
		t, err := parseTime(*body.StartAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid start_at"})
			return
		}
		p.StartAt = &t
	}
	if body.EndAt != nil && *body.EndAt != "" {
		t, err := parseTime(*body.EndAt)
		if err != nil {
			c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid end_at"})
			return
		}
		p.EndAt = &t
	}
	if body.IsActive != nil {
		p.IsActive = *body.IsActive
	} else {
		p.IsActive = existing.IsActive
	}
	updated, err := h.promoSvc.Update(c.Request.Context(), pharmacyID, p)
	if err != nil {
		if errors.GetAppError(err) != nil && errors.GetAppError(err).Code == errors.ErrCodeNotFound {
			c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "promo not found"})
			return
		}
		h.logger.Warn("promo update failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to update promo"})
		return
	}
	c.JSON(http.StatusOK, updated)
}

// Delete deletes a promo. Admin only.
func (h *PromoHandler) Delete(c *gin.Context) {
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
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid promo id"})
		return
	}
	if err := h.promoSvc.Delete(c.Request.Context(), pharmacyID, id); err != nil {
		if errors.GetAppError(err) != nil && errors.GetAppError(err).Code == errors.ErrCodeNotFound {
			c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "promo not found"})
			return
		}
		h.logger.Warn("promo delete failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "failed to delete promo"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func parseTime(s string) (time.Time, error) {
	return time.Parse(time.RFC3339, s)
}
