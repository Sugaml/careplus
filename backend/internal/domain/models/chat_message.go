package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	SenderTypeUser     = "user"
	SenderTypeCustomer = "customer"
)

type ChatMessage struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ConversationID uuid.UUID `gorm:"type:uuid;not null;index" json:"conversation_id"`
	SenderType     string    `gorm:"size:20;not null" json:"sender_type"` // "user" | "customer"
	SenderID       uuid.UUID `gorm:"type:uuid;not null" json:"sender_id"`
	Body           string    `gorm:"type:text" json:"body"`
	AttachmentURL  string    `gorm:"size:1024" json:"attachment_url,omitempty"`
	AttachmentName string    `gorm:"size:255" json:"attachment_name,omitempty"`
	AttachmentType string    `gorm:"size:128" json:"attachment_type,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"` // Used to show "edited" when UpdatedAt > CreatedAt

	Conversation *Conversation `gorm:"foreignKey:ConversationID" json:"conversation,omitempty"`
}

func (ChatMessage) TableName() string { return "chat_messages" }

func (m *ChatMessage) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}
