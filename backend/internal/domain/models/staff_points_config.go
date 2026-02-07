package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// StaffPointsConfig holds per-pharmacy rules for pharmacist/staff earning points from completed sales.
// If missing or zero, no points are awarded when orders are completed.
type StaffPointsConfig struct {
	ID                    uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID            uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex" json:"pharmacy_id"`
	PointsPerCurrencyUnit float64        `gorm:"type:decimal(12,4);not null;default:0" json:"points_per_currency_unit"`   // e.g. 1 point per 100 NPR
	CurrencyUnitForPoints float64        `gorm:"type:decimal(12,2);not null;default:100" json:"currency_unit_for_points"` // e.g. 100 NPR
	CreatedAt             time.Time      `json:"created_at"`
	UpdatedAt             time.Time      `json:"updated_at"`
	DeletedAt             gorm.DeletedAt `gorm:"index" json:"-"`

	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
}

func (StaffPointsConfig) TableName() string { return "staff_points_configs" }

func (s *StaffPointsConfig) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}
