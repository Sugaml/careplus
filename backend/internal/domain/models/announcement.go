package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Announcement types: offer (New Year, seasonal), status (open/closed), event.
const (
	AnnouncementTypeOffer  = "offer"
	AnnouncementTypeStatus = "status"
	AnnouncementTypeEvent  = "event"
)

// Template for popup display: celebration, banner, modal.
const (
	AnnouncementTemplateCelebration = "celebration"
	AnnouncementTemplateBanner      = "banner"
	AnnouncementTemplateModal       = "modal"
)

// Display duration presets (seconds) for how long the popup is shown before auto-dismiss option.
const (
	AnnouncementDisplaySecMin = 1
	AnnouncementDisplaySecMax = 30
)

type Announcement struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID      uuid.UUID  `gorm:"type:uuid;not null;index" json:"pharmacy_id"`
	Type            string     `gorm:"size:32;not null;index" json:"type"`             // offer, status, event
	Template        string     `gorm:"size:32;default:celebration" json:"template"`   // celebration, banner, modal
	Title           string     `gorm:"size:255;not null" json:"title"`
	Body            string     `gorm:"type:text" json:"body"`
	ImageURL        string     `gorm:"size:512" json:"image_url"`
	LinkURL         string     `gorm:"size:512" json:"link_url"`
	DisplaySeconds  int        `gorm:"default:5;not null" json:"display_seconds"`       // 1–30, how long popup is visible before auto-close option
	ValidDays       int        `gorm:"default:7;not null" json:"valid_days"`           // how many days to show (from start_at or from now)
	ShowTerms       bool       `gorm:"default:false" json:"show_terms"`
	TermsText       string     `gorm:"type:text" json:"terms_text"`
	AllowSkipAll    bool       `gorm:"default:true" json:"allow_skip_all"`              // show "Skip all" to user
	StartAt         *time.Time `gorm:"index" json:"start_at"`
	EndAt           *time.Time `gorm:"index" json:"end_at"`
	SortOrder       int        `gorm:"default:0" json:"sort_order"`
	IsActive        bool       `gorm:"default:true" json:"is_active"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`

	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
}

func (Announcement) TableName() string { return "announcements" }

func (a *Announcement) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}

// AnnouncementAck records user dismissal of an announcement or "skip all".
// If SkipAll is true, AnnouncementID may be nil and the user dismissed all announcements (e.g. for 24h).
type AnnouncementAck struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	UserID         uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	AnnouncementID *uuid.UUID `gorm:"type:uuid;index" json:"announcement_id,omitempty"` // nil when SkipAll is true
	AcknowledgedAt time.Time  `gorm:"not null" json:"acknowledged_at"`
	SkipAll        bool       `gorm:"default:false" json:"skip_all"` // if true, user chose "skip all" (hide all for a period)
}

func (AnnouncementAck) TableName() string { return "announcement_acks" }

func (a *AnnouncementAck) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
