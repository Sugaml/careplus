package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BlogPostStatus: draft (author only), pending_approval (awaiting manager), published (visible to all).
const (
	BlogPostStatusDraft          = "draft"
	BlogPostStatusPendingApproval = "pending_approval"
	BlogPostStatusPublished      = "published"
)

type BlogPost struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID   uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex:idx_blog_post_pharmacy_slug" json:"pharmacy_id"`
	CategoryID   *uuid.UUID     `gorm:"type:uuid;index" json:"category_id,omitempty"`
	AuthorID     uuid.UUID      `gorm:"type:uuid;not null;index" json:"author_id"`
	Title        string         `gorm:"size:500;not null" json:"title"`
	Slug         string         `gorm:"size:520;not null;uniqueIndex:idx_blog_post_pharmacy_slug" json:"slug"`
	Excerpt      string         `gorm:"type:text" json:"excerpt"`
	Body         string         `gorm:"type:text;not null" json:"body"`
	Status       string         `gorm:"size:32;not null;default:draft;index" json:"status"` // draft, pending_approval, published
	PublishedAt  *time.Time     `json:"published_at,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	Pharmacy *Pharmacy    `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
	Category *BlogCategory `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Author   *User        `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
}

func (BlogPost) TableName() string { return "blog_posts" }

func (p *BlogPost) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
