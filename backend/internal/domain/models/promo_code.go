package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DiscountType is percent or fixed amount.
type DiscountType string

const (
	DiscountTypePercent DiscountType = "percent"
	DiscountTypeFixed   DiscountType = "fixed"
)

// PromoCode is a pharmacy-scoped discount code for billing (e.g. for visited customers).
type PromoCode struct {
	ID             uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID     uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex:idx_pharmacy_promo_code" json:"pharmacy_id"`
	Code           string         `gorm:"size:50;not null;uniqueIndex:idx_pharmacy_promo_code" json:"code"`
	DiscountType   DiscountType   `gorm:"size:20;not null" json:"discount_type"`
	DiscountValue  float64        `gorm:"type:decimal(12,2);not null" json:"discount_value"`
	MinOrderAmount float64        `gorm:"type:decimal(12,2);default:0" json:"min_order_amount"`
	ValidFrom      time.Time      `gorm:"not null" json:"valid_from"`
	ValidUntil     time.Time      `gorm:"not null;index" json:"valid_until"`
	MaxUses        int            `gorm:"default:0" json:"max_uses"` // 0 = unlimited
	UsedCount      int            `gorm:"default:0" json:"used_count"`
	IsActive       bool           `gorm:"default:true;index" json:"is_active"`
	FirstOrderOnly bool           `gorm:"default:false" json:"first_order_only"` // When true, code valid only for user's first order at this pharmacy
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`

	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
}

func (PromoCode) TableName() string { return "promo_codes" }

func (p *PromoCode) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
