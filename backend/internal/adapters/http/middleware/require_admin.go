package middleware

import (
	"net/http"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
)

const RoleAdmin = "admin"

// RequireAdmin ensures the authenticated user has role "admin". Use after Auth middleware.
// Returns 403 Forbidden if role is not admin.
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "role not set"})
			c.Abort()
			return
		}
		roleStr, ok := role.(string)
		if !ok || roleStr != RoleAdmin {
			c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "admin access required"})
			c.Abort()
			return
		}
		c.Next()
	}
}
