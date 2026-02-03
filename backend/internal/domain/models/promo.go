package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PromoType is offer, announcement, or event.
const (
	PromoTypeOffer        = "offer"
	PromoTypeAnnouncement = "announcement"
	PromoTypeEvent        = "event"
)

type Promo struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID  uuid.UUID  `gorm:"type:uuid;not null;index" json:"pharmacy_id"`
	Type        string     `gorm:"size:32;not null;index" json:"type"` // offer, announcement, event
	Title       string     `gorm:"size:255;not null" json:"title"`
	Description string     `gorm:"type:text" json:"description"`
	ImageURL    string     `gorm:"size:512" json:"image_url"`
	LinkURL     string     `gorm:"size:512" json:"link_url"` // optional CTA link
	StartAt     *time.Time `gorm:"index" json:"start_at"`
	EndAt       *time.Time `gorm:"index" json:"end_at"`
	SortOrder   int        `gorm:"default:0" json:"sort_order"`
	IsActive    bool       `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`

	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
}

func (Promo) TableName() string { return "promos" }

func (p *Promo) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
