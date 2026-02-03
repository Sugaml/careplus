package middleware

import (
	"strings"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func Auth(authProvider outbound.AuthProvider, userRepo outbound.UserRepository, logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(401, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "Missing authorization header"})
			c.Abort()
			return
		}
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(401, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "Invalid authorization header"})
			c.Abort()
			return
		}
		claims, err := authProvider.ValidateAccessToken(parts[1])
		if err != nil {
			logger.Warn("Invalid access token", zap.Error(err))
			c.JSON(401, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "Invalid or expired token"})
			c.Abort()
			return
		}
		user, err := userRepo.GetByID(c.Request.Context(), claims.UserID)
		if err != nil || user == nil || !user.IsActive {
			c.JSON(403, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "User not found or inactive"})
			c.Abort()
			return
		}
		c.Set("user_id", claims.UserID.String())
		c.Set("pharmacy_id", claims.PharmacyID.String())
		c.Set("role", claims.Role)
		c.Next()
	}
}
