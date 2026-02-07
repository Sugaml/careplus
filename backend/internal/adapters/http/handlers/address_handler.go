package handlers

import (
	"net/http"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type AddressHandler struct {
	addressService inbound.UserAddressService
	logger         *zap.Logger
}

func NewAddressHandler(addressService inbound.UserAddressService, logger *zap.Logger) *AddressHandler {
	return &AddressHandler{addressService: addressService, logger: logger}
}

func (h *AddressHandler) List(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	list, err := h.addressService.ListByUser(c.Request.Context(), userID)
	if err != nil {
		if errors.IsAppError(err) {
			appErr := errors.GetAppError(err)
			if appErr.Code == errors.ErrCodeNotFound {
				c.JSON(http.StatusNotFound, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
		}
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "Failed to list addresses"})
		return
	}
	c.JSON(http.StatusOK, list)
}

type createAddressRequest struct {
	Label        string `json:"label"`
	Line1        string `json:"line1" binding:"required"`
	Line2        string `json:"line2"`
	City         string `json:"city" binding:"required"`
	State        string `json:"state"`
	PostalCode   string `json:"postal_code"`
	Country      string `json:"country" binding:"required"`
	Phone        string `json:"phone"`
	SetAsDefault bool   `json:"set_as_default"`
}

func (h *AddressHandler) Create(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	var req createAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	addr, err := h.addressService.Create(c.Request.Context(), userID, req.Label, req.Line1, req.Line2, req.City, req.State, req.PostalCode, req.Country, req.Phone, req.SetAsDefault)
	if err != nil {
		if errors.IsAppError(err) {
			appErr := errors.GetAppError(err)
			if appErr.Code == errors.ErrCodeValidation {
				c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
		}
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "Failed to create address"})
		return
	}
	c.JSON(http.StatusCreated, addr)
}

type updateAddressRequest struct {
	Label        *string `json:"label"`
	Line1        *string `json:"line1"`
	Line2        *string `json:"line2"`
	City         *string `json:"city"`
	State        *string `json:"state"`
	PostalCode   *string `json:"postal_code"`
	Country      *string `json:"country"`
	Phone        *string `json:"phone"`
	SetAsDefault *bool   `json:"set_as_default"`
}

func (h *AddressHandler) Update(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "Invalid address ID"})
		return
	}
	var req updateAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	addr, err := h.addressService.Update(c.Request.Context(), userID, id, req.Label, req.Line1, req.Line2, req.City, req.State, req.PostalCode, req.Country, req.Phone, req.SetAsDefault)
	if err != nil {
		if errors.IsAppError(err) {
			appErr := errors.GetAppError(err)
			if appErr.Code == errors.ErrCodeNotFound {
				c.JSON(http.StatusNotFound, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
			if appErr.Code == errors.ErrCodeForbidden {
				c.JSON(http.StatusForbidden, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
			if appErr.Code == errors.ErrCodeValidation {
				c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
		}
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "Failed to update address"})
		return
	}
	c.JSON(http.StatusOK, addr)
}

func (h *AddressHandler) Delete(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "Invalid address ID"})
		return
	}
	err = h.addressService.Delete(c.Request.Context(), userID, id)
	if err != nil {
		if errors.IsAppError(err) {
			appErr := errors.GetAppError(err)
			if appErr.Code == errors.ErrCodeNotFound {
				c.JSON(http.StatusNotFound, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
			if appErr.Code == errors.ErrCodeForbidden {
				c.JSON(http.StatusForbidden, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
		}
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "Failed to delete address"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Address deleted"})
}

func (h *AddressHandler) SetDefault(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "Invalid address ID"})
		return
	}
	addr, err := h.addressService.SetDefault(c.Request.Context(), userID, id)
	if err != nil {
		if errors.IsAppError(err) {
			appErr := errors.GetAppError(err)
			if appErr.Code == errors.ErrCodeNotFound {
				c.JSON(http.StatusNotFound, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
			if appErr.Code == errors.ErrCodeForbidden {
				c.JSON(http.StatusForbidden, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
		}
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "Failed to set default address"})
		return
	}
	c.JSON(http.StatusOK, addr)
}
