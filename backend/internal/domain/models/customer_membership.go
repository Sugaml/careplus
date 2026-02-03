package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// CustomerMembership links a customer to a membership tier (one per customer per pharmacy via membership).
type CustomerMembership struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	CustomerID   uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex:idx_customer_membership_customer" json:"customer_id"`
	MembershipID uuid.UUID      `gorm:"type:uuid;not null;index" json:"membership_id"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	Customer   *Customer   `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	Membership *Membership `gorm:"foreignKey:MembershipID" json:"membership,omitempty"`
}

func (CustomerMembership) TableName() string { return "customer_memberships" }

func (c *CustomerMembership) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
