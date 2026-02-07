package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// GatewayCode represents known payment gateway types (wallet, QR, COD, etc.).
const (
	GatewayCodeEsewa   = "esewa"
	GatewayCodeKhalti  = "khalti"
	GatewayCodeQR      = "qr"
	GatewayCodeCOD     = "cod"
	GatewayCodeFonepay = "fonepay"
)

type PaymentGateway struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID uuid.UUID      `gorm:"type:uuid;not null;index" json:"pharmacy_id"`
	Code       string         `gorm:"size:50;not null;index:idx_pharmacy_code,unique" json:"code"` // esewa, khalti, qr, cod, fonepay
	Name       string         `gorm:"size:255;not null" json:"name"`
	IsActive   bool           `gorm:"default:true;index" json:"is_active"`
	SortOrder  int            `gorm:"default:0" json:"sort_order"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`

	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
}

func (PaymentGateway) TableName() string { return "payment_gateways" }

func (pg *PaymentGateway) BeforeCreate(tx *gorm.DB) error {
	if pg.ID == uuid.Nil {
		pg.ID = uuid.New()
	}
	return nil
}
