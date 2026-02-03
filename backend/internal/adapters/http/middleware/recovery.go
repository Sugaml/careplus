package middleware

import (
	"net/http"

	"github.com/careplus/pharmacy-backend/internal/adapters/http/dto/response"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func Recovery(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				logger.Error("panic recovered", zap.Any("panic", err))
				c.JSON(http.StatusInternalServerError, response.ErrorResponse{
					Code:    errors.ErrCodeInternal,
					Message: "Internal server error",
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}
