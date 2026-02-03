package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type InvoiceStatus string

const (
	InvoiceStatusDraft  InvoiceStatus = "draft"
	InvoiceStatusIssued InvoiceStatus = "issued"
)

type Invoice struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID    uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex:idx_pharmacy_invoice" json:"pharmacy_id"`
	OrderID       uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex" json:"order_id"`
	InvoiceNumber string         `gorm:"size:50;not null;uniqueIndex:idx_pharmacy_invoice" json:"invoice_number"`
	Status        InvoiceStatus  `gorm:"size:20;default:draft;index" json:"status"`
	IssuedAt      *time.Time     `json:"issued_at"`
	CreatedBy     uuid.UUID      `gorm:"type:uuid;index" json:"created_by"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
	Order    *Order    `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (Invoice) TableName() string { return "invoices" }

func (i *Invoice) BeforeCreate(tx *gorm.DB) error {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	if i.InvoiceNumber == "" {
		i.InvoiceNumber = "INV-" + uuid.New().String()[:8]
	}
	return nil
}
