package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// FeatureFlagsMap is a map of feature key -> enabled (e.g. "products": true). Stored as JSONB.
type FeatureFlagsMap map[string]bool

// DefaultFeatureFlags returns the default set of features (all enabled) for new tenants.
func DefaultFeatureFlags() FeatureFlagsMap {
	return FeatureFlagsMap{
		"products": true, "orders": true, "chat": true, "promos": true,
		"referral": true, "memberships": true, "billing": true, "announcements": true,
		"inventory": true, "statements": true, "categories": true, "reviews": true,
	}
}

// PharmacyConfig holds site/display and company controls per tenant (name, logo, website on/off, features).
// One row per pharmacy/tenant.
type PharmacyConfig struct {
	ID                   uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID           uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex" json:"pharmacy_id"`
	DisplayName          string         `gorm:"size:255" json:"display_name"`
	Location             string         `gorm:"type:text" json:"location"`
	LogoURL              string         `gorm:"size:512" json:"logo_url"`
	BannerURL            string         `gorm:"size:512" json:"banner_url"`
	Tagline              string         `gorm:"size:500" json:"tagline"`
	ContactPhone         string         `gorm:"size:50" json:"contact_phone"`
	ContactEmail         string         `gorm:"size:255" json:"contact_email"`
	PrimaryColor         string         `gorm:"size:20" json:"primary_color"`
	DefaultLanguage      string         `gorm:"size:16;default:en" json:"default_language"`
	WebsiteEnabled       bool           `gorm:"default:true" json:"website_enabled"`       // Enable/disable public website for this company
	FeatureFlags         FeatureFlagsMap `gorm:"type:jsonb;serializer:json" json:"feature_flags,omitempty"` // Per-tenant feature toggles (products, orders, chat, etc.)
	LicenseNo            string         `gorm:"size:100" json:"license_no"`
	VerifiedAt           *time.Time     `gorm:"index" json:"verified_at,omitempty"`
	EstablishedYear      int            `gorm:"default:0" json:"established_year"`
	ReturnRefundPolicy   string         `gorm:"type:text" json:"return_refund_policy,omitempty"`
	ChatEditWindowMinutes int           `gorm:"default:10" json:"chat_edit_window_minutes"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`

	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
}

func (PharmacyConfig) TableName() string { return "pharmacy_configs" }

func (c *PharmacyConfig) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
