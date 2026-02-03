package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// InventoryBatch represents a lot/batch of stock for a product with an expiry date.
// Stock is consumed FEFO (first expiry, first out) when fulfilling orders.
type InventoryBatch struct {
	ID         uuid.UUID   `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID  uuid.UUID   `gorm:"type:uuid;not null;index" json:"product_id"`
	PharmacyID uuid.UUID   `gorm:"type:uuid;not null;index" json:"pharmacy_id"`
	BatchNumber string     `gorm:"size:100;not null" json:"batch_number"`
	Quantity   int         `gorm:"not null" json:"quantity"`
	ExpiryDate *time.Time  `gorm:"index" json:"expiry_date,omitempty"` // nil = no expiry / unknown
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`

	Product *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

func (InventoryBatch) TableName() string { return "inventory_batches" }

func (b *InventoryBatch) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}
