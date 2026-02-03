package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PointsTransactionType is the type of points movement.
type PointsTransactionType string

const (
	PointsTransactionTypeEarnPurchase  PointsTransactionType = "earn_purchase"
	PointsTransactionTypeEarnReferral PointsTransactionType = "earn_referral"
	PointsTransactionTypeRedeem       PointsTransactionType = "redeem"
)

// PointsTransaction records every credit/debit for audit.
// Amount is positive for earn, negative for redeem.
type PointsTransaction struct {
	ID                   uuid.UUID             `gorm:"type:uuid;primaryKey" json:"id"`
	CustomerID           uuid.UUID             `gorm:"type:uuid;not null;index" json:"customer_id"`
	Amount               int                   `gorm:"not null" json:"amount"` // + for earn, - for redeem
	Type                 PointsTransactionType `gorm:"size:30;not null;index" json:"type"`
	OrderID              *uuid.UUID             `gorm:"type:uuid;index" json:"order_id,omitempty"`
	ReferralCustomerID   *uuid.UUID             `gorm:"type:uuid;index" json:"referral_customer_id,omitempty"` // for earn_referral: the customer who was referred
	CreatedAt            time.Time             `json:"created_at"`

	Customer         *Customer `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	Order            *Order    `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	ReferralCustomer *Customer `gorm:"foreignKey:ReferralCustomerID" json:"referral_customer,omitempty"`
}

func (PointsTransaction) TableName() string { return "points_transactions" }

func (p *PointsTransaction) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
