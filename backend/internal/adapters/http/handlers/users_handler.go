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

type UsersHandler struct {
	userService inbound.UserService
	logger      *zap.Logger
}

func NewUsersHandler(userService inbound.UserService, logger *zap.Logger) *UsersHandler {
	return &UsersHandler{userService: userService, logger: logger}
}

// List returns users for the pharmacy; manager sees only pharmacists (enforced by service).
func (h *UsersHandler) List(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	role, _ := c.Get("role")
	pharmacyID, err := uuid.Parse(pharmacyIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy id"})
		return
	}
	list, err := h.userService.List(c.Request.Context(), pharmacyID, role.(string))
	if err != nil {
		h.logger.Error("list users failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

type createUserRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Name     string `json:"name"`
	Role     string `json:"role"` // manager, pharmacist, staff (admin only: manager; manager only: pharmacist)
}

func (h *UsersHandler) Create(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	role, _ := c.Get("role")
	pharmacyID, err := uuid.Parse(pharmacyIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy id"})
		return
	}
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	user, err := h.userService.Create(c.Request.Context(), pharmacyID, role.(string), req.Email, req.Password, req.Name, req.Role)
	if err != nil {
		if errors.IsAppError(err) {
			appErr := errors.GetAppError(err)
			if appErr.Code == errors.ErrCodeConflict {
				c.JSON(http.StatusConflict, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
			if appErr.Code == errors.ErrCodeForbidden {
				c.JSON(http.StatusForbidden, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
			if appErr.Code == errors.ErrCodeNotFound {
				c.JSON(http.StatusNotFound, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
		}
		h.logger.Error("create user failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "Failed to create user"})
		return
	}
	c.JSON(http.StatusCreated, user)
}

func (h *UsersHandler) GetByID(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	role, _ := c.Get("role")
	pharmacyID, err := uuid.Parse(pharmacyIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy id"})
		return
	}
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid user id"})
		return
	}
	user, err := h.userService.GetByID(c.Request.Context(), pharmacyID, role.(string), userID)
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
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, user)
}

type updateUserRequest struct {
	Name     string `json:"name"`
	Role     string `json:"role"`
	IsActive *bool  `json:"is_active"`
}

func (h *UsersHandler) Update(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	role, _ := c.Get("role")
	pharmacyID, err := uuid.Parse(pharmacyIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy id"})
		return
	}
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid user id"})
		return
	}
	var req updateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	var rolePtr *string
	if req.Role != "" {
		rolePtr = &req.Role
	}
	user, err := h.userService.Update(c.Request.Context(), pharmacyID, role.(string), userID, req.Name, rolePtr, req.IsActive)
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
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *UsersHandler) Deactivate(c *gin.Context) {
	pharmacyIDStr, _ := c.Get("pharmacy_id")
	role, _ := c.Get("role")
	pharmacyID, err := uuid.Parse(pharmacyIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid pharmacy id"})
		return
	}
	userID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, response.ErrorResponse{Code: errors.ErrCodeValidation, Message: "invalid user id"})
		return
	}
	user, err := h.userService.Deactivate(c.Request.Context(), pharmacyID, role.(string), userID)
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
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: err.Error()})
		return
	}
	c.JSON(http.StatusOK, user)
}
