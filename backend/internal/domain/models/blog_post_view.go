package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BlogPostView records a view for analytics (one per post per user per day or per session; we use per post per user for simplicity).
type BlogPostView struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PostID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"post_id"`
	UserID    *uuid.UUID     `gorm:"type:uuid;index" json:"user_id,omitempty"` // nil for anonymous
	ViewedAt  time.Time      `json:"viewed_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Post *BlogPost `gorm:"foreignKey:PostID" json:"post,omitempty"`
	User *User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (BlogPostView) TableName() string { return "blog_post_views" }

func (v *BlogPostView) BeforeCreate(tx *gorm.DB) error {
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	return nil
}
