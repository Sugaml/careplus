package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BlogPostComment struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PostID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"post_id"`
	UserID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	ParentID  *uuid.UUID     `gorm:"type:uuid;index" json:"parent_id,omitempty"`
	Body      string         `gorm:"type:text;not null" json:"body"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Post   *BlogPost          `gorm:"foreignKey:PostID" json:"post,omitempty"`
	User   *User              `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Parent *BlogPostComment   `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
}

func (BlogPostComment) TableName() string { return "blog_post_comments" }

func (c *BlogPostComment) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}
