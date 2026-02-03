package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DailyLogStatus string

const (
	DailyLogOpen   DailyLogStatus = "open"
	DailyLogDone   DailyLogStatus = "done"
)

type DailyLog struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"pharmacy_id"`
	Date        time.Time      `gorm:"type:date;not null;index" json:"date"`
	Title       string         `gorm:"size:255;not null" json:"title"`
	Description string         `gorm:"type:text" json:"description"`
	Status      DailyLogStatus `gorm:"size:20;default:open" json:"status"`
	CreatedBy   uuid.UUID      `gorm:"type:uuid;not null;index" json:"created_by"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Creator *User `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
}

func (DailyLog) TableName() string { return "daily_logs" }

func (d *DailyLog) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}
