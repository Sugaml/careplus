package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ActivityLog struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID uuid.UUID `gorm:"type:uuid;not null;index" json:"pharmacy_id"`
	UserID     uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	Action     string    `gorm:"size:255;not null" json:"action"`       // e.g. "GET /orders", "POST /products"
	EntityType string    `gorm:"size:64" json:"entity_type,omitempty"`  // e.g. "order", "product"
	EntityID   string    `gorm:"size:64" json:"entity_id,omitempty"`   // e.g. order id, product id
	Details    string    `gorm:"type:text" json:"details,omitempty"`   // optional JSON or text
	IPAddress  string    `gorm:"size:45" json:"ip_address,omitempty"`  // IPv4 or IPv6
	CreatedAt  time.Time `json:"created_at"`

	User     *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
}

func (ActivityLog) TableName() string { return "activity_logs" }

func (a *ActivityLog) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
