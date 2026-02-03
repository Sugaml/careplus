package middleware

import (
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

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
		ip := c.ClientIP()
		if err := svc.Create(c.Request.Context(), pharmacyID, userID, action, "", "", "", ip); err != nil {
			logger.Debug("activity log create failed", zap.Error(err))
		}
		c.Next()
	}
}
