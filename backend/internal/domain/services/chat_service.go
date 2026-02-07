package services

import (
	"context"
	"errors"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	apperr "github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const defaultChatEditWindowMinutes = 10

type chatService struct {
	convRepo    outbound.ConversationRepository
	msgRepo     outbound.ChatMessageRepository
	configRepo  outbound.PharmacyConfigRepository
	customerRepo outbound.CustomerRepository
	logger      *zap.Logger
}

func NewChatService(
	convRepo outbound.ConversationRepository,
	msgRepo outbound.ChatMessageRepository,
	configRepo outbound.PharmacyConfigRepository,
	customerRepo outbound.CustomerRepository,
	logger *zap.Logger,
) inbound.ChatService {
	return &chatService{
		convRepo:     convRepo,
		msgRepo:      msgRepo,
		configRepo:   configRepo,
		customerRepo: customerRepo,
		logger:       logger,
	}
}

func (s *chatService) GetOrCreateConversation(ctx context.Context, pharmacyID, customerID uuid.UUID) (*models.Conversation, error) {
	customer, err := s.customerRepo.GetByID(ctx, customerID)
	if err != nil || customer == nil {
		return nil, apperr.ErrNotFound("customer")
	}
	if customer.PharmacyID != pharmacyID {
		return nil, apperr.ErrForbidden("customer does not belong to this pharmacy")
	}
	conv, err := s.convRepo.GetByPharmacyAndCustomer(ctx, pharmacyID, customerID)
	if err == nil {
		return conv, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		s.logger.Warn("get conversation failed", zap.Error(err))
		return nil, err
	}
	cid := customerID
	conv = &models.Conversation{PharmacyID: pharmacyID, CustomerID: &cid}
	if err := s.convRepo.Create(ctx, conv); err != nil {
		s.logger.Warn("create conversation failed", zap.Error(err))
		return nil, err
	}
	conv.Customer = customer
	return conv, nil
}

func (s *chatService) GetConversationByPharmacyAndCustomer(ctx context.Context, pharmacyID, customerID uuid.UUID) (*models.Conversation, error) {
	conv, err := s.convRepo.GetByPharmacyAndCustomer(ctx, pharmacyID, customerID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.ErrNotFound("conversation")
		}
		return nil, err
	}
	return conv, nil
}

func (s *chatService) ListConversations(ctx context.Context, pharmacyID uuid.UUID, userID *uuid.UUID, limit, offset int) ([]*models.Conversation, int64, error) {
	return s.convRepo.ListByPharmacy(ctx, pharmacyID, userID, limit, offset)
}

func (s *chatService) GetOrCreateConversationForUser(ctx context.Context, pharmacyID, userID uuid.UUID) (*models.Conversation, error) {
	conv, err := s.convRepo.GetByPharmacyAndUser(ctx, pharmacyID, userID)
	if err == nil {
		return conv, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		s.logger.Warn("get conversation by user failed", zap.Error(err))
		return nil, err
	}
	conv = &models.Conversation{PharmacyID: pharmacyID, UserID: &userID}
	if err := s.convRepo.Create(ctx, conv); err != nil {
		s.logger.Warn("create user conversation failed", zap.Error(err))
		return nil, err
	}
	return conv, nil
}

func (s *chatService) GetConversationByID(ctx context.Context, conversationID, pharmacyID uuid.UUID, customerID *uuid.UUID, userID *uuid.UUID, role string) (*models.Conversation, error) {
	conv, err := s.convRepo.GetByID(ctx, conversationID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.ErrNotFound("conversation")
		}
		return nil, err
	}
	if conv.PharmacyID != pharmacyID {
		return nil, apperr.ErrNotFound("conversation")
	}
	if customerID != nil {
		if conv.CustomerID == nil || *conv.CustomerID != *customerID {
			return nil, apperr.ErrNotFound("conversation")
		}
	}
	if conv.UserID != nil {
		// User-scoped conversation: only that user or non-staff (admin/manager/pharmacist) can access
		if userID != nil && role == "staff" {
			if *conv.UserID != *userID {
				return nil, apperr.ErrNotFound("conversation")
			}
		}
	}
	return conv, nil
}

func (s *chatService) ListMessages(ctx context.Context, conversationID, pharmacyID uuid.UUID, customerID *uuid.UUID, userID *uuid.UUID, role string, limit, offset int) ([]*models.ChatMessage, int64, error) {
	_, err := s.GetConversationByID(ctx, conversationID, pharmacyID, customerID, userID, role)
	if err != nil {
		return nil, 0, err
	}
	return s.msgRepo.ListByConversationID(ctx, conversationID, limit, offset)
}

func (s *chatService) SendMessage(ctx context.Context, conversationID uuid.UUID, senderType string, senderID uuid.UUID, body, attachmentURL, attachmentName, attachmentType string) (*models.ChatMessage, error) {
	if senderType != models.SenderTypeUser && senderType != models.SenderTypeCustomer {
		return nil, apperr.ErrValidation("invalid sender_type")
	}
	conv, err := s.convRepo.GetByID(ctx, conversationID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.ErrNotFound("conversation")
		}
		return nil, err
	}
	if senderType == models.SenderTypeCustomer {
		if conv.CustomerID == nil || *conv.CustomerID != senderID {
			return nil, apperr.ErrForbidden("sender does not match conversation customer")
		}
	} else {
		if conv.PharmacyID == uuid.Nil {
			return nil, apperr.ErrValidation("invalid conversation")
		}
		if conv.UserID != nil {
			if *conv.UserID != senderID {
				return nil, apperr.ErrForbidden("sender does not match conversation user")
			}
		}
	}
	msg := &models.ChatMessage{
		ConversationID: conversationID,
		SenderType:     senderType,
		SenderID:       senderID,
		Body:           body,
		AttachmentURL:  attachmentURL,
		AttachmentName: attachmentName,
		AttachmentType: attachmentType,
	}
	if err := s.msgRepo.Create(ctx, msg); err != nil {
		s.logger.Warn("create message failed", zap.Error(err))
		return nil, err
	}
	now := time.Now()
	conv.LastMessageAt = &now
	_ = s.convRepo.Update(ctx, conv)
	return msg, nil
}

func (s *chatService) getEditWindowMinutes(ctx context.Context, pharmacyID uuid.UUID) int {
	cfg, err := s.configRepo.GetByPharmacyID(ctx, pharmacyID)
	if err != nil || cfg == nil {
		return defaultChatEditWindowMinutes
	}
	if cfg.ChatEditWindowMinutes <= 0 {
		return 0
	}
	return cfg.ChatEditWindowMinutes
}

func (s *chatService) EditMessage(ctx context.Context, conversationID, messageID, pharmacyID uuid.UUID, customerID *uuid.UUID, userID *uuid.UUID, role string, body string) (*models.ChatMessage, error) {
	conv, err := s.GetConversationByID(ctx, conversationID, pharmacyID, customerID, userID, role)
	if err != nil {
		return nil, err
	}
	msg, err := s.msgRepo.GetByID(ctx, messageID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.ErrNotFound("message")
		}
		return nil, err
	}
	if msg.ConversationID != conversationID {
		return nil, apperr.ErrNotFound("message")
	}
	var senderID uuid.UUID
	if customerID != nil {
		senderID = *customerID
		if msg.SenderType != models.SenderTypeCustomer || msg.SenderID != senderID {
			return nil, apperr.ErrForbidden("can only edit your own messages")
		}
	} else {
		senderID = *userID
		if msg.SenderType != models.SenderTypeUser || msg.SenderID != senderID {
			return nil, apperr.ErrForbidden("can only edit your own messages")
		}
	}
	editWindow := s.getEditWindowMinutes(ctx, conv.PharmacyID)
	if editWindow <= 0 {
		return nil, apperr.ErrForbidden("editing is disabled")
	}
	deadline := msg.CreatedAt.Add(time.Duration(editWindow) * time.Minute)
	if time.Now().After(deadline) {
		return nil, apperr.ErrForbidden("message can only be edited within the configured time window")
	}
	msg.Body = body
	if err := s.msgRepo.Update(ctx, msg); err != nil {
		s.logger.Warn("update message failed", zap.Error(err))
		return nil, err
	}
	return msg, nil
}

func (s *chatService) DeleteMessage(ctx context.Context, conversationID, messageID, pharmacyID uuid.UUID, customerID *uuid.UUID, userID *uuid.UUID, role string) error {
	_, err := s.GetConversationByID(ctx, conversationID, pharmacyID, customerID, userID, role)
	if err != nil {
		return err
	}
	msg, err := s.msgRepo.GetByID(ctx, messageID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return apperr.ErrNotFound("message")
		}
		return err
	}
	if msg.ConversationID != conversationID {
		return apperr.ErrNotFound("message")
	}
	var senderID uuid.UUID
	if customerID != nil {
		senderID = *customerID
		if msg.SenderType != models.SenderTypeCustomer || msg.SenderID != senderID {
			return apperr.ErrForbidden("can only delete your own messages")
		}
	} else {
		senderID = *userID
		if msg.SenderType != models.SenderTypeUser || msg.SenderID != senderID {
			return apperr.ErrForbidden("can only delete your own messages")
		}
	}
	return s.msgRepo.Delete(ctx, messageID)
}

func (s *chatService) DeleteConversation(ctx context.Context, conversationID, pharmacyID uuid.UUID, customerID *uuid.UUID, userID *uuid.UUID, role string) error {
	conv, err := s.GetConversationByID(ctx, conversationID, pharmacyID, customerID, userID, role)
	if err != nil {
		return err
	}
	if conv.CustomerID != nil {
		if customerID == nil || *conv.CustomerID != *customerID {
			return apperr.ErrForbidden("can only delete your own conversation")
		}
	} else if conv.UserID != nil {
		if userID == nil || *conv.UserID != *userID {
			return apperr.ErrForbidden("can only delete your own conversation")
		}
	} else {
		return apperr.ErrForbidden("cannot delete this conversation")
	}
	if err := s.msgRepo.DeleteByConversationID(ctx, conversationID); err != nil {
		s.logger.Warn("delete conversation messages failed", zap.Error(err))
		return err
	}
	return s.convRepo.Delete(ctx, conversationID)
}

func (s *chatService) GetChatEditWindowMinutes(ctx context.Context, pharmacyID uuid.UUID) int {
	return s.getEditWindowMinutes(ctx, pharmacyID)
}
