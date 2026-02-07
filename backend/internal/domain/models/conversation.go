package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Conversation struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID    uuid.UUID  `gorm:"type:uuid;not null" json:"pharmacy_id"`
	CustomerID    *uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_conversations_pharmacy_customer" json:"customer_id,omitempty"`
	UserID        *uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_conversations_pharmacy_user" json:"user_id,omitempty"`
	LastMessageAt *time.Time `json:"last_message_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`

	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
	Customer *Customer `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	User     *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Conversation) TableName() string { return "conversations" }

func (c *Conversation) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
