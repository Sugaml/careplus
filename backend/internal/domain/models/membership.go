package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Membership is a loyalty tier offered by a pharmacy. Name and details are
// defined by the pharmacy (via API/UI); optional discount_percent applies at checkout.
type Membership struct {
	ID              uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"pharmacy_id"`
	Name            string         `gorm:"size:100;not null" json:"name" binding:"required"`
	Description     string         `gorm:"type:text" json:"description"`
	DiscountPercent float64        `gorm:"default:0" json:"discount_percent" binding:"gte=0,lte=100"` // 0–100, e.g. 5 = 5% off
	IsActive        bool           `gorm:"default:true" json:"is_active"`
	SortOrder       int            `gorm:"default:0" json:"sort_order"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`

	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
}

func (Membership) TableName() string { return "memberships" }

func (m *Membership) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}
