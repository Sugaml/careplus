package middleware

import (
	"strings"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ChatAuth accepts either staff JWT (sets user_id, pharmacy_id, role) or chat customer token (sets pharmacy_id, customer_id, chat_customer=true).
// Staff: user_id, pharmacy_id, role are set; customer_id is not set.
// Customer: pharmacy_id, customer_id, and "chat_customer"=true are set; user_id is not set.
func ChatAuth(authProvider outbound.AuthProvider, userRepo outbound.UserRepository, logger *zap.Logger) gin.HandlerFunc {
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
		token := parts[1]

		// Try staff JWT first
		claims, err := authProvider.ValidateAccessToken(token)
		if err == nil && claims != nil {
			user, err := userRepo.GetByID(c.Request.Context(), claims.UserID)
			if err != nil || user == nil || !user.IsActive {
				c.JSON(403, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "User not found or inactive"})
				c.Abort()
				return
			}
			c.Set("user_id", claims.UserID.String())
			c.Set("pharmacy_id", claims.PharmacyID.String())
			c.Set("role", claims.Role)
			c.Set("chat_customer", false)
			c.Next()
			return
		}

		// Try chat customer token
		chatClaims, err := authProvider.ValidateChatCustomerToken(token)
		if err == nil && chatClaims != nil {
			c.Set("pharmacy_id", chatClaims.PharmacyID.String())
			c.Set("customer_id", chatClaims.CustomerID.String())
			c.Set("chat_customer", true)
			c.Next()
			return
		}

		logger.Warn("Chat auth failed", zap.Error(err))
		c.JSON(401, response.ErrorResponse{Code: errors.ErrCodeUnauthorized, Message: "Invalid or expired token"})
		c.Abort()
	}
}
