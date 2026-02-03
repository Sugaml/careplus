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

type CategoryHandler struct {
	categoryService inbound.CategoryService
	logger          *zap.Logger
}

func NewCategoryHandler(categoryService inbound.CategoryService, logger *zap.Logger) *CategoryHandler {
	return &CategoryHandler{categoryService: categoryService, logger: logger}
}

type categoryBody struct {
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description"`
	SortOrder   int     `json:"sort_order"`
	ParentID    *string `json:"parent_id,omitempty"` // optional; nil = top-level category, set = subcategory
}

func (b categoryBody) toCategory(id, pharmacyID uuid.UUID) models.Category {
	cat := models.Category{
		ID:          id,
		PharmacyID:  pharmacyID,
		Name:        b.Name,
		Description: b.Description,
		SortOrder:   b.SortOrder,
	}
	if b.ParentID != nil && *b.ParentID != "" {
		if pid, err := uuid.Parse(*b.ParentID); err == nil {
			cat.ParentID = &pid
		}
	}
	return cat
}

func (h *CategoryHandler) Create(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var body categoryBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	cat := body.toCategory(uuid.Nil, pharmacyID)
	if err := h.categoryService.Create(c.Request.Context(), &cat); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, cat)
}

func (h *CategoryHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	cat, err := h.categoryService.GetByID(c.Request.Context(), id)
	if err != nil || cat == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "category not found"})
		return
	}
	c.JSON(http.StatusOK, cat)
}

func (h *CategoryHandler) List(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	parentIDStr := c.Query("parent_id")
	if parentIDStr == "" {
		list, err := h.categoryService.ListByPharmacy(c.Request.Context(), pharmacyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
			return
		}
		c.JSON(http.StatusOK, list)
		return
	}
	parentID, err := uuid.Parse(parentIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid parent_id"})
		return
	}
	list, err := h.categoryService.ListByParentID(c.Request.Context(), pharmacyID, &parentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// ListByPharmacyID returns categories for a pharmacy by path param (public, no auth). Optional ?parent_id= for subcategories.
func (h *CategoryHandler) ListByPharmacyID(c *gin.Context) {
	pharmacyID, err := uuid.Parse(c.Param("pharmacyId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy id"})
		return
	}
	parentIDStr := c.Query("parent_id")
	if parentIDStr == "" {
		list, err := h.categoryService.ListByPharmacy(c.Request.Context(), pharmacyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
			return
		}
		c.JSON(http.StatusOK, list)
		return
	}
	parentID, err := uuid.Parse(parentIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid parent_id"})
		return
	}
	list, err := h.categoryService.ListByParentID(c.Request.Context(), pharmacyID, &parentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

func (h *CategoryHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var body categoryBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	cat := body.toCategory(id, pharmacyID)
	if err := h.categoryService.Update(c.Request.Context(), &cat); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, cat)
}

func (h *CategoryHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	if err := h.categoryService.Delete(c.Request.Context(), id); err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}
