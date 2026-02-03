package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PharmacyConfig holds site/display configuration per pharmacy (name, logo, banner, location, etc.).
// One row per pharmacy.
type PharmacyConfig struct {
	ID              uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID      uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex" json:"pharmacy_id"`
	DisplayName     string         `gorm:"size:255" json:"display_name"`   // Pharmacy name for website/branding
	Location        string         `gorm:"type:text" json:"location"`       // Address or location text
	LogoURL         string         `gorm:"size:512" json:"logo_url"`        // URL to logo image
	BannerURL       string         `gorm:"size:512" json:"banner_url"`     // URL to banner image
	Tagline         string         `gorm:"size:500" json:"tagline"`         // Short tagline/slogan
	ContactPhone    string         `gorm:"size:50" json:"contact_phone"`
	ContactEmail    string         `gorm:"size:255" json:"contact_email"`
	PrimaryColor    string         `gorm:"size:20" json:"primary_color"`   // e.g. #0066cc for theme
	LicenseNo       string         `gorm:"size:100" json:"license_no"`      // Pharmacy license number (for trust badge)
	VerifiedAt      *time.Time     `gorm:"index" json:"verified_at,omitempty"` // When pharmacy was verified (shows Verified badge)
	EstablishedYear int            `gorm:"default:0" json:"established_year"` // Year established (e.g. 2010)
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`

	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
}

func (PharmacyConfig) TableName() string { return "pharmacy_configs" }

func (c *PharmacyConfig) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
