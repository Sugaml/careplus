package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BlogPostLike struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PostID    uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex:idx_blog_post_like_post_user" json:"post_id"`
	UserID    uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex:idx_blog_post_like_post_user" json:"user_id"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Post *BlogPost `gorm:"foreignKey:PostID" json:"post,omitempty"`
	User *User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (BlogPostLike) TableName() string { return "blog_post_likes" }

func (l *BlogPostLike) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}
