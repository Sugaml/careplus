package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ReviewComment is a comment on a product review.
type ReviewComment struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	ReviewID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"review_id"`
	UserID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Body      string         `gorm:"type:text;not null" json:"body"`
	ParentID  *uuid.UUID     `gorm:"type:uuid;index" json:"parent_id,omitempty"` // optional reply-to
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Review *ProductReview `gorm:"foreignKey:ReviewID" json:"review,omitempty"`
	User   *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (ReviewComment) TableName() string { return "review_comments" }

func (c *ReviewComment) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
