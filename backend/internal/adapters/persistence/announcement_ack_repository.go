package persistence

import (
	"context"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type announcementAckRepo struct {
	db *gorm.DB
}

func NewAnnouncementAckRepository(db *gorm.DB) outbound.AnnouncementAckRepository {
	return &announcementAckRepo{db: db}
}

func (r *announcementAckRepo) Create(ctx context.Context, a *models.AnnouncementAck) error {
	return r.db.WithContext(ctx).Create(a).Error
}

func (r *announcementAckRepo) HasAcked(ctx context.Context, userID, announcementID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.AnnouncementAck{}).
		Where("user_id = ? AND announcement_id = ? AND skip_all = ?", userID, announcementID, false).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *announcementAckRepo) HasSkippedAllSince(ctx context.Context, userID uuid.UUID, since time.Time) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&models.AnnouncementAck{}).
		Where("user_id = ? AND skip_all = ? AND acknowledged_at >= ?", userID, true, since).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
