package http

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/careplus/pharmacy-backend/internal/infrastructure/config"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type Server struct {
	router *gin.Engine
	cfg    *config.Config
	logger *zap.Logger
	server *http.Server
}

func NewServer(router *gin.Engine, cfg *config.Config, logger *zap.Logger) *Server {
	return &Server{router: router, cfg: cfg, logger: logger}
}

func (s *Server) Start() error {
	addr := ":" + s.cfg.Server.Port
	s.server = &http.Server{
		Addr:         addr,
		Handler:      s.router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}
	s.logger.Info("Starting HTTP server", zap.String("addr", addr))
	if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return fmt.Errorf("server failed: %w", err)
	}
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info("Shutting down HTTP server")
	return s.server.Shutdown(ctx)
}
