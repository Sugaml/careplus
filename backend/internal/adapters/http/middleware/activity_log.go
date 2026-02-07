package middleware

import (
	"strings"

	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// actionDescription maps method+path patterns to human-readable descriptions for the activity feed.
func actionDescription(method, path string) string {
	path = strings.TrimPrefix(path, "/api/v1")
	path = strings.TrimSuffix(path, "/")
	if path == "" {
		path = "/"
	}
	key := method + " " + path
	// Map common API paths to readable descriptions
	descriptions := map[string]string{
		"GET /dashboard/stats":           "Viewed dashboard",
		"GET /config":                   "Viewed config",
		"PUT /config":                   "Updated config",
		"GET /activity":                 "Viewed activity log",
		"GET /orders":                   "Viewed orders",
		"POST /orders":                  "Created order",
		"GET /orders/:id":               "Viewed order",
		"PUT /orders/:id":               "Updated order",
		"GET /products":                 "Viewed products",
		"POST /products":                "Created product",
		"GET /products/:id":              "Viewed product",
		"PUT /products/:id":             "Updated product",
		"DELETE /products/:id":          "Deleted product",
		"GET /users":                    "Viewed users",
		"POST /users":                   "Created user",
		"GET /users/:id":                "Viewed user",
		"PUT /users/:id":                "Updated user",
		"POST /users/:id/deactivate":    "Deactivated user",
		"GET /categories":               "Viewed categories",
		"POST /categories":               "Created category",
		"PUT /categories/:id":            "Updated category",
		"DELETE /categories/:id":         "Deleted category",
		"GET /pharmacies":               "Viewed pharmacies",
		"GET /pharmacies/:id":           "Viewed pharmacy",
		"PUT /pharmacies/:id":           "Updated pharmacy",
		"GET /notifications":            "Viewed notifications",
		"POST /notifications/:id/read":  "Marked notification read",
		"GET /auth/me":                  "Viewed profile",
		"PATCH /auth/me":                "Updated profile",
		"PATCH /auth/me/password":       "Changed password",
	}
	if d, ok := descriptions[key]; ok {
		return d
	}
	// Fallback: derive from method
	switch method {
	case "GET":
		return "Viewed " + path
	case "POST":
		return "Created " + path
	case "PUT", "PATCH":
		return "Updated " + path
	case "DELETE":
		return "Deleted " + path
	default:
		return method + " " + path
	}
}

// ActivityLog records each authenticated API request (method + path) for the activity feed.
// Must be used after Auth middleware so user_id and pharmacy_id are set.
func ActivityLog(svc inbound.ActivityLogService, logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		pharmacyIDVal, ok1 := c.Get("pharmacy_id")
		userIDVal, ok2 := c.Get("user_id")
		if !ok1 || !ok2 {
			c.Next()
			return
		}
		pharmacyID, err1 := uuid.Parse(pharmacyIDVal.(string))
		userID, err2 := uuid.Parse(userIDVal.(string))
		if err1 != nil || err2 != nil {
			c.Next()
			return
		}
		action := c.Request.Method + " " + c.FullPath()
		if action == " " {
			action = c.Request.Method + " " + c.Request.URL.Path
		}
		desc := actionDescription(c.Request.Method, c.FullPath())
		if desc == "" {
			desc = action
		}
		ip := c.ClientIP()
		if err := svc.Create(c.Request.Context(), pharmacyID, userID, action, desc, "", "", "", ip); err != nil {
			logger.Debug("activity log create failed", zap.Error(err))
		}
		c.Next()
	}
}
