package persistence

import (
	"context"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type announcementRepo struct {
	db *gorm.DB
}

func NewAnnouncementRepository(db *gorm.DB) outbound.AnnouncementRepository {
	return &announcementRepo{db: db}
}

func (r *announcementRepo) Create(ctx context.Context, a *models.Announcement) error {
	return r.db.WithContext(ctx).Create(a).Error
}

func (r *announcementRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Announcement, error) {
	var a models.Announcement
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&a).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *announcementRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, activeOnly bool) ([]*models.Announcement, error) {
	now := time.Now()
	q := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID)
	if activeOnly {
		q = q.Where("is_active = ?", true).
			Where("(start_at IS NULL OR start_at <= ?)", now).
			Where("(end_at IS NULL OR end_at >= ?)", now)
	}
	q = q.Order("sort_order ASC, created_at DESC")
	var list []*models.Announcement
	err := q.Find(&list).Error
	return list, err
}

func (r *announcementRepo) Update(ctx context.Context, a *models.Announcement) error {
	return r.db.WithContext(ctx).Save(a).Error
}

func (r *announcementRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Announcement{}, "id = ?", id).Error
}
