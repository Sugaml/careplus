package services

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type notificationService struct {
	repo   outbound.NotificationRepository
	logger *zap.Logger
}

func NewNotificationService(repo outbound.NotificationRepository, logger *zap.Logger) inbound.NotificationService {
	return &notificationService{repo: repo, logger: logger}
}

func (s *notificationService) Create(ctx context.Context, pharmacyID, userID uuid.UUID, title, message, notifType string) (*models.Notification, error) {
	if notifType == "" {
		notifType = "info"
	}
	n := &models.Notification{
		PharmacyID: pharmacyID,
		UserID:     userID,
		Title:      title,
		Message:    message,
		Type:       notifType,
	}
	if err := s.repo.Create(ctx, n); err != nil {
		s.logger.Warn("notification create failed", zap.Error(err))
		return nil, err
	}
	return n, nil
}

func (s *notificationService) ListByUser(ctx context.Context, userID uuid.UUID, unreadOnly bool, limit, offset int) ([]*models.Notification, error) {
	return s.repo.ListByUser(ctx, userID, unreadOnly, limit, offset)
}

func (s *notificationService) CountUnreadByUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	return s.repo.CountUnreadByUser(ctx, userID)
}

func (s *notificationService) MarkRead(ctx context.Context, id, userID uuid.UUID) error {
	return s.repo.MarkRead(ctx, id, userID)
}

func (s *notificationService) MarkAllRead(ctx context.Context, userID uuid.UUID) error {
	return s.repo.MarkAllRead(ctx, userID)
}
