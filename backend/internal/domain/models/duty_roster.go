package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ShiftType for duty roster: morning, evening, full
type ShiftType string

const (
	ShiftMorning ShiftType = "morning"
	ShiftEvening ShiftType = "evening"
	ShiftFull    ShiftType = "full"
)

type DutyRoster struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID uuid.UUID      `gorm:"type:uuid;not null;index" json:"pharmacy_id"`
	UserID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"` // pharmacist
	Date       time.Time      `gorm:"type:date;not null;index" json:"date"`
	ShiftType  ShiftType      `gorm:"size:20;not null" json:"shift_type"`
	Notes      string         `gorm:"size:500" json:"notes"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (DutyRoster) TableName() string { return "duty_rosters" }

func (d *DutyRoster) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}
