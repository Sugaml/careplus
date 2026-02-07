package services

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type activityLogService struct {
	repo   outbound.ActivityLogRepository
	logger *zap.Logger
}

func NewActivityLogService(repo outbound.ActivityLogRepository, logger *zap.Logger) inbound.ActivityLogService {
	return &activityLogService{repo: repo, logger: logger}
}

func (s *activityLogService) Create(ctx context.Context, pharmacyID, userID uuid.UUID, action, description, entityType, entityID, details, ipAddress string) error {
	a := &models.ActivityLog{
		PharmacyID:   pharmacyID,
		UserID:       userID,
		Action:       action,
		Description:  description,
		EntityType:   entityType,
		EntityID:     entityID,
		Details:      details,
		IPAddress:    ipAddress,
	}
	if err := s.repo.Create(ctx, a); err != nil {
		s.logger.Warn("activity log create failed", zap.Error(err))
		return err
	}
	return nil
}

func (s *activityLogService) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, limit, offset int) ([]*models.ActivityLog, error) {
	return s.repo.ListByPharmacy(ctx, pharmacyID, limit, offset)
}
