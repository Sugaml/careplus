package middleware

import (
	"strings"

	"github.com/careplus/pharmacy-backend/internal/infrastructure/config"
	"github.com/gin-gonic/gin"
)

func CORS(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		allowed := getAllowedOrigin(cfg, origin)
		if allowed != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", allowed)
			if allowed != "*" {
				c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			}
		}
		c.Writer.Header().Set("Access-Control-Allow-Headers", getAllowedHeaders(cfg))
		c.Writer.Header().Set("Access-Control-Allow-Methods", getAllowedMethods(cfg))
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func getAllowedOrigin(cfg *config.Config, requestOrigin string) string {
	if len(cfg.CORS.AllowedOrigins) == 0 {
		return "*"
	}
	if requestOrigin == "" {
		return cfg.CORS.AllowedOrigins[0]
	}
	for _, o := range cfg.CORS.AllowedOrigins {
		if strings.EqualFold(o, requestOrigin) {
			return requestOrigin
		}
	}
	return ""
}

func getAllowedHeaders(cfg *config.Config) string {
	if len(cfg.CORS.AllowedHeaders) == 0 {
		return "Content-Type, Authorization"
	}
	return strings.Join(cfg.CORS.AllowedHeaders, ", ")
}

func getAllowedMethods(cfg *config.Config) string {
	if len(cfg.CORS.AllowedMethods) == 0 {
		return "GET, POST, PUT, DELETE, PATCH, OPTIONS"
	}
	return strings.Join(cfg.CORS.AllowedMethods, ", ")
}
