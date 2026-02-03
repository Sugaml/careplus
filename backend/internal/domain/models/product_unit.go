package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProductUnit is a per-pharmacy unit of measure (e.g. tablet, bottle, box, ml).
// Maintained by the pharmacist like Category; used for product unit dropdown.
type ProductUnit struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"pharmacy_id"`
	Name        string         `gorm:"size:100;not null" json:"name" binding:"required"`
	Description string         `gorm:"type:text" json:"description"`
	SortOrder   int            `gorm:"default:0" json:"sort_order"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
}

func (ProductUnit) TableName() string { return "product_units" }

func (u *ProductUnit) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}
