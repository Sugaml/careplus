package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Notification struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID uuid.UUID  `gorm:"type:uuid;not null;index" json:"pharmacy_id"`
	UserID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	Title      string     `gorm:"size:255;not null" json:"title"`
	Message    string     `gorm:"type:text" json:"message"`
	Type       string     `gorm:"size:64;default:info" json:"type"` // e.g. order, payment, info
	ReadAt     *time.Time `json:"read_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`

	User     *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
}

func (Notification) TableName() string { return "notifications" }

func (n *Notification) BeforeCreate(tx *gorm.DB) error {
	if n.ID == uuid.Nil {
		n.ID = uuid.New()
	}
	return nil
}
