package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ProductReview is a user's review (rating + feedback) for a product.
type ProductReview struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	ProductID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"product_id"`
	UserID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Rating     int            `gorm:"not null" json:"rating"` // 1-5
	Title      string         `gorm:"size:200" json:"title"`
	Body       string         `gorm:"type:text" json:"body"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`

	Product *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	User    *User   `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (ProductReview) TableName() string { return "product_reviews" }

func (r *ProductReview) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}
