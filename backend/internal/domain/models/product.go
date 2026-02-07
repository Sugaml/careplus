package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Product struct {
	ID                 uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID         uuid.UUID      `gorm:"type:uuid;not null;index" json:"pharmacy_id"`
	Name               string         `gorm:"size:255;not null" json:"name"`
	Description        string         `gorm:"type:text" json:"description"`
	SKU                string         `gorm:"size:100;uniqueIndex;not null" json:"sku"`
	Category           string         `gorm:"size:100;index" json:"category"`       // denormalized name for filter/display; synced from Category when CategoryID set
	CategoryID         *uuid.UUID     `gorm:"type:uuid;index" json:"category_id,omitempty"` // optional FK: product type = category (parent) + subcategory (child)
	UnitPrice          float64        `gorm:"type:decimal(12,2);not null" json:"unit_price"`
	DiscountPercent    float64        `gorm:"type:decimal(5,2);default:0" json:"discount_percent"` // 0–100; when > 0, unit_price is sale price
	Currency           string         `gorm:"size:10;default:NPR" json:"currency"`
	StockQuantity      int            `gorm:"default:0" json:"stock_quantity"`
	Unit               string         `gorm:"size:50;default:units" json:"unit"`
	RequiresRx         bool           `gorm:"default:false" json:"requires_rx"`
	IsActive           bool           `gorm:"default:true" json:"is_active"`
	ExpiryDate         *time.Time     `gorm:"index" json:"expiry_date,omitempty"`
	ManufacturingDate  *time.Time     `gorm:"index" json:"manufacturing_date,omitempty"`
	Brand              string         `gorm:"size:150" json:"brand"`
	Barcode            string         `gorm:"size:100;index" json:"barcode"`
	StorageConditions  string         `gorm:"size:255" json:"storage_conditions"`
	DosageForm         string         `gorm:"size:80" json:"dosage_form"`  // tablet, capsule, syrup, etc.
	PackSize           string            `gorm:"size:80" json:"pack_size"`   // e.g. "10 tablets", "100ml"
	GenericName        string            `gorm:"size:255" json:"generic_name"`
	Hashtags           []string          `gorm:"type:jsonb;serializer:json" json:"hashtags,omitempty"`   // e.g. ["vitamin", "organic"]
	Labels             map[string]string `gorm:"type:jsonb;serializer:json" json:"labels,omitempty"`    // key-value e.g. {"certified": "organic", "origin": "local"}
	CreatedAt          time.Time         `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`

	Pharmacy       *Pharmacy       `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
	CategoryDetail *Category      `gorm:"foreignKey:CategoryID" json:"category_detail,omitempty"` // when set, Parent gives parent (product type = parent + subcategory)
	Images         []*ProductImage `gorm:"foreignKey:ProductID" json:"images,omitempty"`
}

func (Product) TableName() string { return "products" }

func (p *Product) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
