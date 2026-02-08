package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ReturnRequestStatus is the status of an order return request.
type ReturnRequestStatus string

const (
	ReturnRequestStatusPending  ReturnRequestStatus = "pending"
	ReturnRequestStatusApproved ReturnRequestStatus = "approved"
	ReturnRequestStatusRejected ReturnRequestStatus = "rejected"
)

// StringSlice is a slice of strings stored as JSON in the DB.
type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	if len(s) == 0 {
		return "[]", nil
	}
	return json.Marshal(s)
}

func (s *StringSlice) Scan(value interface{}) error {
	if value == nil {
		*s = nil
		return nil
	}
	b, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(b, s)
}

// OrderReturnRequest is a customer's return request for a completed order (e.g. defect).
// Allowed within 3 days of order completion; requires video, photo(s), notes, and description.
type OrderReturnRequest struct {
	ID          uuid.UUID           `gorm:"type:uuid;primaryKey" json:"id"`
	OrderID     uuid.UUID           `gorm:"type:uuid;not null;uniqueIndex" json:"order_id"`
	UserID      uuid.UUID           `gorm:"type:uuid;not null;index" json:"user_id"`
	Status      ReturnRequestStatus  `gorm:"size:50;default:pending" json:"status"`
	VideoURL    string              `gorm:"type:text" json:"video_url"`
	PhotoURLs   StringSlice         `gorm:"type:text" json:"photo_urls"` // JSON array of URLs
	Notes       string              `gorm:"type:text" json:"notes"`
	Description string              `gorm:"type:text" json:"description"`
	CreatedAt   time.Time           `json:"created_at"`
	UpdatedAt   time.Time           `json:"updated_at"`

	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
	User  *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (OrderReturnRequest) TableName() string { return "order_return_requests" }

func (r *OrderReturnRequest) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}
