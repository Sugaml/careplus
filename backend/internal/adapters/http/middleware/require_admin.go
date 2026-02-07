package middleware

import "github.com/gin-gonic/gin"

// RequireAdmin ensures the authenticated user has role "admin". Use after Auth middleware.
// Returns 403 Forbidden if role is not admin.
func RequireAdmin() gin.HandlerFunc {
	return RequireAnyRole(RoleAdmin)
}
