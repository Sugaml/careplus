package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type chatMessageRepo struct {
	db *gorm.DB
}

func NewChatMessageRepository(db *gorm.DB) outbound.ChatMessageRepository {
	return &chatMessageRepo{db: db}
}

func (r *chatMessageRepo) Create(ctx context.Context, m *models.ChatMessage) error {
	return r.db.WithContext(ctx).Create(m).Error
}

func (r *chatMessageRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.ChatMessage, error) {
	var m models.ChatMessage
	err := r.db.WithContext(ctx).First(&m, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *chatMessageRepo) Update(ctx context.Context, m *models.ChatMessage) error {
	return r.db.WithContext(ctx).Save(m).Error
}

func (r *chatMessageRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.ChatMessage{}, "id = ?", id).Error
}

func (r *chatMessageRepo) DeleteByConversationID(ctx context.Context, conversationID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("conversation_id = ?", conversationID).Delete(&models.ChatMessage{}).Error
}

func (r *chatMessageRepo) ListByConversationID(ctx context.Context, conversationID uuid.UUID, limit, offset int) ([]*models.ChatMessage, int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&models.ChatMessage{}).Where("conversation_id = ?", conversationID).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	var list []*models.ChatMessage
	err := r.db.WithContext(ctx).Where("conversation_id = ?", conversationID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&list).Error
	return list, total, err
}
