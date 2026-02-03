package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PaymentStatus string

const (
	PaymentStatusPending   PaymentStatus = "pending"
	PaymentStatusCompleted PaymentStatus = "completed"
	PaymentStatusFailed    PaymentStatus = "failed"
	PaymentStatusRefunded  PaymentStatus = "refunded"
)

type PaymentMethod string

const (
	PaymentMethodCash   PaymentMethod = "cash"
	PaymentMethodCard  PaymentMethod = "card"
	PaymentMethodOnline PaymentMethod = "online"
	PaymentMethodOther  PaymentMethod = "other"
)

type Payment struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID       uuid.UUID      `gorm:"type:uuid;not null;index" json:"order_id"`
	PharmacyID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"pharmacy_id"`
	Amount        float64        `gorm:"type:decimal(12,2);not null" json:"amount"`
	Currency      string         `gorm:"size:10;default:NPR" json:"currency"`
	Method        PaymentMethod `gorm:"size:50;not null" json:"method"`
	Status        PaymentStatus `gorm:"size:50;default:pending;index" json:"status"`
	Reference     string         `gorm:"size:255" json:"reference"`
	PaidAt        *time.Time     `json:"paid_at"`
	CreatedBy     uuid.UUID      `gorm:"type:uuid;index" json:"created_by"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (Payment) TableName() string { return "payments" }

func (p *Payment) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
