package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BlogCategory struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID  uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex:idx_blog_category_pharmacy_slug" json:"pharmacy_id"`
	ParentID    *uuid.UUID     `gorm:"type:uuid;index" json:"parent_id,omitempty"`
	Name        string         `gorm:"size:200;not null" json:"name"`
	Slug        string         `gorm:"size:220;not null;uniqueIndex:idx_blog_category_pharmacy_slug" json:"slug"`
	Description string         `gorm:"type:text" json:"description"`
	SortOrder   int            `gorm:"default:0" json:"sort_order"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	Pharmacy *Pharmacy        `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
	Parent   *BlogCategory   `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
}

func (BlogCategory) TableName() string { return "blog_categories" }

func (c *BlogCategory) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
