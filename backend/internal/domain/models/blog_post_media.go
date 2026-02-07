package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BlogPostMediaType: image, video (short video).
const (
	BlogPostMediaTypeImage = "image"
	BlogPostMediaTypeVideo = "video"
)

type BlogPostMedia struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PostID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"post_id"`
	MediaType string         `gorm:"size:20;not null" json:"media_type"` // image, video
	URL       string         `gorm:"type:text;not null" json:"url"`
	Caption   string         `gorm:"size:500" json:"caption"`
	SortOrder int            `gorm:"default:0" json:"sort_order"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Post *BlogPost `gorm:"foreignKey:PostID" json:"post,omitempty"`
}

func (BlogPostMedia) TableName() string { return "blog_post_media" }

func (m *BlogPostMedia) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}
