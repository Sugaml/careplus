package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Customer is a shopper identified by pharmacy + phone (and optionally email).
// Used for referral codes and points balance; created or linked on first order.
type Customer struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID    uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex:idx_customers_pharmacy_phone;uniqueIndex:idx_customers_pharmacy_referral" json:"pharmacy_id"`
	Name          string         `gorm:"size:255" json:"name"`
	Phone         string         `gorm:"size:50;not null;uniqueIndex:idx_customers_pharmacy_phone" json:"phone"`
	Email         string         `gorm:"size:255" json:"email"`
	ReferralCode  string         `gorm:"size:20;not null;uniqueIndex:idx_customers_pharmacy_referral" json:"referral_code"`
	PointsBalance int            `gorm:"not null;default:0" json:"points_balance"`
	ReferredByID  *uuid.UUID     `gorm:"type:uuid;index" json:"referred_by_id,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	Pharmacy   *Pharmacy  `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
	ReferredBy *Customer  `gorm:"foreignKey:ReferredByID" json:"referred_by,omitempty"`
}

func (Customer) TableName() string { return "customers" }

func (c *Customer) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
