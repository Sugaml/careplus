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

type DutyRosterHandler struct {
	rosterService inbound.DutyRosterService
	logger       *zap.Logger
}

func NewDutyRosterHandler(rosterService inbound.DutyRosterService, logger *zap.Logger) *DutyRosterHandler {
	return &DutyRosterHandler{rosterService: rosterService, logger: logger}
}

type createDutyRosterRequest struct {
	UserID    uuid.UUID       `json:"user_id" binding:"required"`
	Date      string          `json:"date" binding:"required"` // YYYY-MM-DD
	ShiftType models.ShiftType `json:"shift_type" binding:"required,oneof=morning evening full"`
	Notes     string          `json:"notes"`
}

func (h *DutyRosterHandler) Create(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, err := uuid.Parse(pharmacyIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy id"})
		return
	}
	var req createDutyRosterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid date format (use YYYY-MM-DD)"})
		return
	}
	d, err := h.rosterService.Create(c.Request.Context(), pharmacyID, req.UserID, date, req.ShiftType, req.Notes)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusCreated, d)
}

func (h *DutyRosterHandler) GetByID(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	d, err := h.rosterService.GetByID(c.Request.Context(), pharmacyID, id)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *DutyRosterHandler) List(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	fromStr := c.DefaultQuery("from", "")
	toStr := c.DefaultQuery("to", "")
	if fromStr == "" || toStr == "" {
		// default: current week
		now := time.Now()
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		fromStr = now.AddDate(0, 0, -(weekday - 1)).Format("2006-01-02")
		toStr = now.AddDate(0, 0, 7-weekday).Format("2006-01-02")
	}
	from, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid from date (use YYYY-MM-DD)"})
		return
	}
	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid to date (use YYYY-MM-DD)"})
		return
	}
	list, err := h.rosterService.ListByDateRange(c.Request.Context(), pharmacyID, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

type updateDutyRosterRequest struct {
	UserID    *uuid.UUID       `json:"user_id"`
	Date      *string          `json:"date"` // YYYY-MM-DD
	ShiftType *models.ShiftType `json:"shift_type"`
	Notes     *string          `json:"notes"`
}

func (h *DutyRosterHandler) Update(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	var req updateDutyRosterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	var datePtr *time.Time
	if req.Date != nil {
		d, err := time.Parse("2006-01-02", *req.Date)
		if err != nil {
			c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid date format"})
			return
		}
		datePtr = &d
	}
	d, err := h.rosterService.Update(c.Request.Context(), pharmacyID, id, req.UserID, datePtr, req.ShiftType, req.Notes)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, d)
}

func (h *DutyRosterHandler) Delete(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid id"})
		return
	}
	if err := h.rosterService.Delete(c.Request.Context(), pharmacyID, id); err != nil {
		writeServiceError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
