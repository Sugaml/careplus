package middleware

import "github.com/gin-gonic/gin"

// RequireAdminOrManager ensures the authenticated user has role "admin" or "manager". Use after Auth middleware.
// Returns 403 Forbidden otherwise.
func RequireAdminOrManager() gin.HandlerFunc {
	return RequireAnyRole(RoleAdmin, RoleManager)
}
