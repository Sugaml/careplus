package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type UsersHandler struct {
	userService        inbound.UserService
	activityLogService inbound.ActivityLogService
	logger             *zap.Logger
}

func NewUsersHandler(userService inbound.UserService, activityLogService inbound.ActivityLogService, logger *zap.Logger) *UsersHandler {
	return &UsersHandler{userService: userService, activityLogService: activityLogService, logger: logger}
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
	// Pharmacist-only (optional when role is pharmacist)
	LicenseNumber string `json:"license_number"`
	Qualification  string `json:"qualification"`
	CVURL         string `json:"cv_url"`
	PhotoURL      string `json:"photo_url"`
	DateOfBirth   string `json:"date_of_birth"` // ISO date YYYY-MM-DD
	Gender        string `json:"gender"`
	Phone         string `json:"phone"`
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
	var pharmacist *inbound.PharmacistProfileInput
	if req.Role == "pharmacist" {
		pharmacist = &inbound.PharmacistProfileInput{}
		if req.LicenseNumber != "" {
			pharmacist.LicenseNumber = &req.LicenseNumber
		}
		if req.Qualification != "" {
			pharmacist.Qualification = &req.Qualification
		}
		if req.CVURL != "" {
			pharmacist.CVURL = &req.CVURL
		}
		if req.PhotoURL != "" {
			pharmacist.PhotoURL = &req.PhotoURL
		}
		if req.DateOfBirth != "" {
			if t, err := time.Parse("2006-01-02", req.DateOfBirth); err == nil {
				pharmacist.DateOfBirth = &t
			}
		}
		if req.Gender != "" {
			pharmacist.Gender = &req.Gender
		}
		if req.Phone != "" {
			pharmacist.Phone = &req.Phone
		}
	}
	user, err := h.userService.Create(c.Request.Context(), pharmacyID, role.(string), req.Email, req.Password, req.Name, req.Role, pharmacist)
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
	// Pharmacist profile (optional when user is pharmacist)
	LicenseNumber *string `json:"license_number"`
	Qualification  *string `json:"qualification"`
	CVURL         *string `json:"cv_url"`
	PhotoURL      *string `json:"photo_url"`
	DateOfBirth   *string `json:"date_of_birth"` // ISO date YYYY-MM-DD
	Gender        *string `json:"gender"`
	Phone         *string `json:"phone"`
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
	var pharmacist *inbound.PharmacistProfileInput
	if req.LicenseNumber != nil || req.Qualification != nil || req.CVURL != nil || req.PhotoURL != nil || req.DateOfBirth != nil || req.Gender != nil || req.Phone != nil {
		pharmacist = &inbound.PharmacistProfileInput{
			LicenseNumber: req.LicenseNumber,
			Qualification: req.Qualification,
			CVURL:         req.CVURL,
			PhotoURL:      req.PhotoURL,
			Gender:        req.Gender,
			Phone:         req.Phone,
		}
		if req.DateOfBirth != nil && *req.DateOfBirth != "" {
			if t, err := time.Parse("2006-01-02", *req.DateOfBirth); err == nil {
				pharmacist.DateOfBirth = &t
			}
		}
	}
	user, err := h.userService.Update(c.Request.Context(), pharmacyID, role.(string), userID, req.Name, rolePtr, req.IsActive, pharmacist)
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
	// Audit log: what changed
	if h.activityLogService != nil {
		changes := make(map[string]interface{})
		if req.Name != "" {
			changes["name"] = req.Name
		}
		if req.Role != "" {
			changes["role"] = req.Role
		}
		if req.IsActive != nil {
			changes["is_active"] = *req.IsActive
		}
		if len(changes) > 0 {
			details, _ := json.Marshal(map[string]interface{}{"user_id": userID.String(), "changes": changes})
			actorIDVal, _ := c.Get("user_id")
			actorID, _ := uuid.Parse(actorIDVal.(string))
			_ = h.activityLogService.Create(c.Request.Context(), pharmacyID, actorID, "PUT /users/"+userID.String(), "User updated", "user", userID.String(), string(details), c.ClientIP())
		}
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
	// Audit log: user deactivated (enable/disable)
	if h.activityLogService != nil {
		details, _ := json.Marshal(map[string]interface{}{"user_id": userID.String(), "is_active": false})
		actorIDVal, _ := c.Get("user_id")
		actorID, _ := uuid.Parse(actorIDVal.(string))
		_ = h.activityLogService.Create(c.Request.Context(), pharmacyID, actorID, "POST /users/"+userID.String()+"/deactivate", "User deactivated", "user", userID.String(), string(details), c.ClientIP())
	}
	c.JSON(http.StatusOK, user)
}
