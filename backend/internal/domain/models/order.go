package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OrderStatus string

const (
	OrderStatusPending   OrderStatus = "pending"
	OrderStatusConfirmed OrderStatus = "confirmed"
	OrderStatusProcessing OrderStatus = "processing"
	OrderStatusReady     OrderStatus = "ready"
	OrderStatusCompleted OrderStatus = "completed"
	OrderStatusCancelled OrderStatus = "cancelled"
)

type Order struct {
	ID              uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"pharmacy_id"`
	OrderNumber     string         `gorm:"size:50;uniqueIndex;not null" json:"order_number"`
	CustomerName    string         `gorm:"size:255" json:"customer_name"`
	CustomerPhone   string         `gorm:"size:50" json:"customer_phone"`
	CustomerEmail   string         `gorm:"size:255" json:"customer_email"`
	CustomerID      *uuid.UUID     `gorm:"type:uuid;index" json:"customer_id,omitempty"`
	ReferralCodeUsed string        `gorm:"size:50" json:"referral_code_used,omitempty"`
	PointsRedeemed  int            `gorm:"default:0" json:"points_redeemed"`
	Status          OrderStatus    `gorm:"size:50;default:pending;index" json:"status"`
	SubTotal        float64        `gorm:"type:decimal(12,2);not null" json:"sub_total"`
	TaxAmount       float64        `gorm:"type:decimal(12,2);default:0" json:"tax_amount"`
	DiscountAmount  float64        `gorm:"type:decimal(12,2);default:0" json:"discount_amount"`
	PromoCodeID     *uuid.UUID     `gorm:"type:uuid;index" json:"promo_code_id,omitempty"`
	TotalAmount     float64        `gorm:"type:decimal(12,2);not null" json:"total_amount"`
	Currency        string         `gorm:"size:10;default:NPR" json:"currency"`
	Notes             string         `gorm:"type:text" json:"notes"`
	DeliveryAddress   string         `gorm:"type:text" json:"delivery_address,omitempty"` // snapshot of selected user address at order time
	CreatedBy         uuid.UUID      `gorm:"type:uuid;index" json:"created_by"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`

	Pharmacy   *Pharmacy   `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
	PromoCode  *PromoCode  `gorm:"foreignKey:PromoCodeID" json:"promo_code,omitempty"`
	Customer   *Customer   `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	Items      []OrderItem `gorm:"foreignKey:OrderID" json:"items,omitempty"`
	Payments   []Payment   `gorm:"foreignKey:OrderID" json:"payments,omitempty"`
}

func (Order) TableName() string { return "orders" }

func (o *Order) BeforeCreate(tx *gorm.DB) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	if o.OrderNumber == "" {
		o.OrderNumber = "ORD-" + uuid.New().String()[:8]
	}
	return nil
}

type OrderItem struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"order_id"`
	ProductID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"product_id"`
	Quantity   int            `gorm:"not null" json:"quantity"`
	UnitPrice  float64        `gorm:"type:decimal(12,2);not null" json:"unit_price"`
	TotalPrice float64        `gorm:"type:decimal(12,2);not null" json:"total_price"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`

	Product *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

func (OrderItem) TableName() string { return "order_items" }

func (oi *OrderItem) BeforeCreate(tx *gorm.DB) error {
	if oi.ID == uuid.Nil {
		oi.ID = uuid.New()
	}
	return nil
}
