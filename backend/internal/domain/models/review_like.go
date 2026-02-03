package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ReviewLike records a user liking a review (helpful).
type ReviewLike struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	ReviewID  uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex:idx_review_user" json:"review_id"`
	UserID    uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex:idx_review_user" json:"user_id"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Review *ProductReview `gorm:"foreignKey:ReviewID" json:"review,omitempty"`
	User   *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (ReviewLike) TableName() string { return "review_likes" }

func (l *ReviewLike) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}
