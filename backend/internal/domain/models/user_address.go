package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserAddress struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Label     string         `gorm:"size:100" json:"label"`           // e.g. "Home", "Office"
	Line1     string         `gorm:"size:255;not null" json:"line1"`
	Line2     string         `gorm:"size:255" json:"line2"`
	City      string         `gorm:"size:100;not null" json:"city"`
	State     string         `gorm:"size:100" json:"state"`
	PostalCode string        `gorm:"size:20" json:"postal_code"`
	Country   string         `gorm:"size:100;not null" json:"country"`
	Phone     string         `gorm:"size:30" json:"phone"`
	IsDefault bool           `gorm:"default:false" json:"is_default"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	User *User `gorm:"foreignKey:UserID" json:"-"`
}

func (UserAddress) TableName() string { return "user_addresses" }

func (a *UserAddress) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
