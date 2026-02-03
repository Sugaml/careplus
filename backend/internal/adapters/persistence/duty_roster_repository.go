package persistence

import (
	"context"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type dutyRosterRepo struct {
	db *gorm.DB
}

func NewDutyRosterRepository(db *gorm.DB) outbound.DutyRosterRepository {
	return &dutyRosterRepo{db: db}
}

func (r *dutyRosterRepo) Create(ctx context.Context, d *models.DutyRoster) error {
	return r.db.WithContext(ctx).Create(d).Error
}

func (r *dutyRosterRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.DutyRoster, error) {
	var d models.DutyRoster
	err := r.db.WithContext(ctx).Preload("User").First(&d, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *dutyRosterRepo) ListByPharmacyAndDateRange(ctx context.Context, pharmacyID uuid.UUID, from, to time.Time) ([]*models.DutyRoster, error) {
	var list []*models.DutyRoster
	err := r.db.WithContext(ctx).Preload("User").
		Where("pharmacy_id = ? AND date >= ? AND date <= ?", pharmacyID, from, to).
		Order("date ASC, user_id ASC").
		Find(&list).Error
	return list, err
}

func (r *dutyRosterRepo) Update(ctx context.Context, d *models.DutyRoster) error {
	return r.db.WithContext(ctx).Save(d).Error
}

func (r *dutyRosterRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.DutyRoster{}, "id = ?", id).Error
}
