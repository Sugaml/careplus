package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ProductImage struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID uuid.UUID      `gorm:"type:uuid;not null;index" json:"product_id"`
	URL       string         `gorm:"size:512;not null" json:"url"`
	IsPrimary bool           `gorm:"default:false" json:"is_primary"`
	SortOrder int            `gorm:"default:0" json:"sort_order"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Product *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

func (ProductImage) TableName() string { return "product_images" }

func (p *ProductImage) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
