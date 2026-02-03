package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Pharmacy struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string         `gorm:"size:255;not null" json:"name"`
	LicenseNo   string         `gorm:"size:100;uniqueIndex" json:"license_no"`
	Address     string         `gorm:"type:text" json:"address"`
	Phone       string         `gorm:"size:50" json:"phone"`
	Email       string         `gorm:"size:255" json:"email"`
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Pharmacy) TableName() string { return "pharmacies" }

func (p *Pharmacy) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
