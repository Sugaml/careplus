package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BusinessType identifies the kind of business (tenant) for dynamic UI/labels.
const (
	BusinessTypePharmacy = "pharmacy"
	BusinessTypeRetail   = "retail"
	BusinessTypeClinic   = "clinic"
	BusinessTypeOther    = "other"
)

type Pharmacy struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Name          string         `gorm:"size:255;not null" json:"name"`
	LicenseNo     string         `gorm:"size:100;uniqueIndex" json:"license_no"`
	TenantCode    string         `gorm:"size:64;uniqueIndex" json:"tenant_code"`    // Unique tenant identifier (e.g. "careplus")
	HostnameSlug  string         `gorm:"size:128;uniqueIndex" json:"hostname_slug"` // Hostname or short name for URL
	BusinessType  string         `gorm:"size:32;default:pharmacy" json:"business_type"` // pharmacy, retail, clinic, other
	Address       string         `gorm:"type:text" json:"address"`
	Phone         string         `gorm:"size:50" json:"phone"`
	Email         string         `gorm:"size:255" json:"email"`
	IsActive      bool           `gorm:"default:true" json:"is_active"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Pharmacy) TableName() string { return "pharmacies" }

func (p *Pharmacy) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
