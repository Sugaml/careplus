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

type AuthHandler struct {
	authService inbound.AuthService
	logger      *zap.Logger
}

func NewAuthHandler(authService inbound.AuthService, logger *zap.Logger) *AuthHandler {
	return &AuthHandler{authService: authService, logger: logger}
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type registerRequest struct {
	PharmacyID uuid.UUID `json:"pharmacy_id" binding:"required"`
	Email      string    `json:"email" binding:"required,email"`
	Password   string    `json:"password" binding:"required,min=6"`
	Name       string    `json:"name"`
	Role       string    `json:"role"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	accessToken, refreshToken, user, err := h.authService.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		if errors.IsAppError(err) && errors.GetAppError(err).Code == errors.ErrCodeInvalidCredentials {
			c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeInvalidCredentials, Message: "Invalid email or password"})
			return
		}
		if errors.IsAppError(err) && errors.GetAppError(err).Code == errors.ErrCodeForbidden {
			c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "Login failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"expires_in":    900,
		"user":          user,
	})
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	if req.Role == "" {
		req.Role = "staff"
	}
	// Public registration may only create end-user (staff) accounts
	if req.Role != "staff" {
		c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "Registration is only allowed with role 'staff'"})
		return
	}
	user, err := h.authService.Register(c.Request.Context(), req.PharmacyID, req.Email, req.Password, req.Name, req.Role)
	if err != nil {
		if errors.IsAppError(err) {
			appErr := errors.GetAppError(err)
			if appErr.Code == errors.ErrCodeConflict {
				c.JSON(http.StatusConflict, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
			if appErr.Code == errors.ErrCodeNotFound {
				c.JSON(http.StatusNotFound, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
		}
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "Registration failed"})
		return
	}
	c.JSON(http.StatusCreated, user)
}

func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	accessToken, err := h.authService.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "Invalid refresh token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"access_token": accessToken, "expires_in": 900})
}

func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	user, err := h.authService.GetCurrentUser(c.Request.Context(), userID)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, response.ErrorResponse{Code: errors.ErrCodeNotFound, Message: "User not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

type updateProfileRequest struct {
	Name string `json:"name"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=6"`
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	var req changePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	err := h.authService.ChangePassword(c.Request.Context(), userID, req.CurrentPassword, req.NewPassword)
	if err != nil {
		if errors.IsAppError(err) {
			appErr := errors.GetAppError(err)
			if appErr.Code == errors.ErrCodeInvalidCredentials {
				c.JSON(http.StatusUnauthorized, response.ErrorResponse{Code: appErr.Code, Message: "Current password is incorrect"})
				return
			}
			if appErr.Code == errors.ErrCodeNotFound {
				c.JSON(http.StatusNotFound, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
			if appErr.Code == errors.ErrCodeForbidden {
				c.JSON(http.StatusForbidden, response.ErrorResponse{Code: appErr.Code, Message: appErr.Message})
				return
			}
		}
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "Failed to change password"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Password changed successfully"})
}

func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	userID, _ := uuid.Parse(userIDStr.(string))
	var req updateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, response.BindValidationError(errors.ErrCodeValidation, "Invalid input", err))
		return
	}
	user, err := h.authService.UpdateProfile(c.Request.Context(), userID, req.Name)
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
		c.JSON(http.StatusInternalServerError, response.ErrorResponse{Code: errors.ErrCodeInternal, Message: "Failed to update profile"})
		return
	}
	c.JSON(http.StatusOK, user)
}
