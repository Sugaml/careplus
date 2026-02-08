package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// OrderFeedback is a customer's feedback (rating + optional comment) for a completed order.
// One feedback per user per order; only the order creator (created_by) may submit.
type OrderFeedback struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID   uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex:idx_order_feedback_user" json:"order_id"`
	UserID    uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex:idx_order_feedback_user" json:"user_id"`
	Rating    int            `gorm:"not null" json:"rating"` // 1-5
	Comment   string         `gorm:"type:text" json:"comment"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	User  *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (OrderFeedback) TableName() string { return "order_feedbacks" }

func (f *OrderFeedback) BeforeCreate(tx *gorm.DB) error {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	return nil
}
