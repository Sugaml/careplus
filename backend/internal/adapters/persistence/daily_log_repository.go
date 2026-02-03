package persistence

import (
	"context"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type dailyLogRepo struct {
	db *gorm.DB
}

func NewDailyLogRepository(db *gorm.DB) outbound.DailyLogRepository {
	return &dailyLogRepo{db: db}
}

func (r *dailyLogRepo) Create(ctx context.Context, d *models.DailyLog) error {
	return r.db.WithContext(ctx).Create(d).Error
}

func (r *dailyLogRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.DailyLog, error) {
	var d models.DailyLog
	err := r.db.WithContext(ctx).Preload("Creator").First(&d, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *dailyLogRepo) ListByPharmacyAndDate(ctx context.Context, pharmacyID uuid.UUID, date time.Time) ([]*models.DailyLog, error) {
	var list []*models.DailyLog
	start := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	end := start.Add(24 * time.Hour)
	err := r.db.WithContext(ctx).Preload("Creator").
		Where("pharmacy_id = ? AND date >= ? AND date < ?", pharmacyID, start, end).
		Order("created_at ASC").
		Find(&list).Error
	return list, err
}

func (r *dailyLogRepo) ListByPharmacyAndDateRange(ctx context.Context, pharmacyID uuid.UUID, from, to time.Time) ([]*models.DailyLog, error) {
	var list []*models.DailyLog
	err := r.db.WithContext(ctx).Preload("Creator").
		Where("pharmacy_id = ? AND date >= ? AND date <= ?", pharmacyID, from, to).
		Order("date ASC, created_at ASC").
		Find(&list).Error
	return list, err
}

func (r *dailyLogRepo) Update(ctx context.Context, d *models.DailyLog) error {
	return r.db.WithContext(ctx).Save(d).Error
}

func (r *dailyLogRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.DailyLog{}, "id = ?", id).Error
}
