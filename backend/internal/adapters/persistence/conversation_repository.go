package persistence

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type conversationRepo struct {
	db *gorm.DB
}

func NewConversationRepository(db *gorm.DB) outbound.ConversationRepository {
	return &conversationRepo{db: db}
}

func (r *conversationRepo) Create(ctx context.Context, c *models.Conversation) error {
	return r.db.WithContext(ctx).Create(c).Error
}

func (r *conversationRepo) GetByID(ctx context.Context, id uuid.UUID) (*models.Conversation, error) {
	var c models.Conversation
	err := r.db.WithContext(ctx).Preload("Pharmacy").Preload("Customer").First(&c, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *conversationRepo) GetByPharmacyAndCustomer(ctx context.Context, pharmacyID, customerID uuid.UUID) (*models.Conversation, error) {
	var c models.Conversation
	err := r.db.WithContext(ctx).Where("pharmacy_id = ? AND customer_id = ?", pharmacyID, customerID).
		Preload("Customer").First(&c).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *conversationRepo) GetByPharmacyAndUser(ctx context.Context, pharmacyID, userID uuid.UUID) (*models.Conversation, error) {
	var c models.Conversation
	err := r.db.WithContext(ctx).Where("pharmacy_id = ? AND user_id = ?", pharmacyID, userID).
		First(&c).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *conversationRepo) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, userID *uuid.UUID, limit, offset int) ([]*models.Conversation, int64, error) {
	base := r.db.WithContext(ctx).Model(&models.Conversation{}).Where("pharmacy_id = ?", pharmacyID)
	if userID != nil {
		base = base.Where("user_id = ?", *userID)
	}
	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	q := r.db.WithContext(ctx).Where("pharmacy_id = ?", pharmacyID)
	if userID != nil {
		q = q.Where("user_id = ?", *userID)
	}
	q = q.Preload("Customer").Preload("User").
		Order("COALESCE(last_message_at, created_at) DESC").
		Limit(limit).
		Offset(offset)
	var list []*models.Conversation
	err := q.Find(&list).Error
	return list, total, err
}

func (r *conversationRepo) Update(ctx context.Context, c *models.Conversation) error {
	return r.db.WithContext(ctx).Save(c).Error
}

func (r *conversationRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&models.Conversation{}, "id = ?", id).Error
}
