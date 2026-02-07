package middleware

import (
	"net/http"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
)

// Role constants used across middleware and handlers.
const (
	RoleAdmin      = "admin"
	RoleManager    = "manager"
	RolePharmacist = "pharmacist"
	RoleStaff      = "staff" // end-user / buyer
)

// StaffRoles are roles that can access management features (excludes end-user "staff").
var StaffRoles = []string{RoleAdmin, RoleManager, RolePharmacist}

// RequireAnyRole returns a middleware that allows only the given roles.
// Use after Auth middleware. Returns 403 if the user's role is not in the list.
func RequireAnyRole(allowedRoles ...string) gin.HandlerFunc {
	set := make(map[string]bool)
	for _, r := range allowedRoles {
		set[r] = true
	}
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "role not set"})
			c.Abort()
			return
		}
		roleStr, ok := role.(string)
		if !ok || !set[roleStr] {
			c.JSON(http.StatusForbidden, response.ErrorResponse{Code: errors.ErrCodeForbidden, Message: "insufficient role for this action"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequireStaffRole allows admin, manager, or pharmacist (not end-user "staff").
// Use for product/category/inventory/invoice/payment management and similar.
func RequireStaffRole() gin.HandlerFunc {
	return RequireAnyRole(StaffRoles...)
}
