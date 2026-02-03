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
	"gorm.io/gorm"
)

type ConfigHandler struct {
	configService inbound.PharmacyConfigService
	logger        *zap.Logger
}

func NewConfigHandler(configService inbound.PharmacyConfigService, logger *zap.Logger) *ConfigHandler {
	return &ConfigHandler{configService: configService, logger: logger}
}

// GetOrCreate returns config for the authenticated user's pharmacy, creating default if missing (protected).
func (h *ConfigHandler) GetOrCreate(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	cfg, err := h.configService.GetOrCreateByPharmacyID(c.Request.Context(), pharmacyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

// Upsert creates or updates config for the authenticated user's pharmacy (protected).
func (h *ConfigHandler) Upsert(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	pharmacyID, _ := uuid.Parse(pharmacyIDStr.(string))
	var input models.PharmacyConfig
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	input.PharmacyID = pharmacyID
	cfg, err := h.configService.Upsert(c.Request.Context(), pharmacyID, &input)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	c.JSON(http.StatusOK, cfg)
}

// GetByPharmacyID returns config for a pharmacy by path param (public, no auth).
func (h *ConfigHandler) GetByPharmacyID(c *gin.Context) {
	pharmacyID, err := uuid.Parse(c.Param("pharmacyId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy id"})
		return
	}
	cfg, err := h.configService.GetByPharmacyID(c.Request.Context(), pharmacyID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "config not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, cfg)
}
