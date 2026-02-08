package services

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
)

type orderFeedbackService struct {
	orderRepo   outbound.OrderRepository
	feedbackRepo outbound.OrderFeedbackRepository
}

func NewOrderFeedbackService(orderRepo outbound.OrderRepository, feedbackRepo outbound.OrderFeedbackRepository) inbound.OrderFeedbackService {
	return &orderFeedbackService{orderRepo: orderRepo, feedbackRepo: feedbackRepo}
}

func (s *orderFeedbackService) Create(ctx context.Context, orderID, userID uuid.UUID, rating int, comment string) (*models.OrderFeedback, error) {
	if rating < 1 || rating > 5 {
		return nil, errors.ErrValidation("rating must be between 1 and 5")
	}
	order, err := s.orderRepo.GetByID(ctx, orderID)
	if err != nil || order == nil {
		return nil, errors.ErrNotFound("order")
	}
	if order.CreatedBy != userID {
		return nil, errors.ErrForbidden("only the person who placed the order can submit feedback")
	}
	if order.Status != models.OrderStatusCompleted {
		return nil, errors.ErrValidation("feedback can only be submitted for completed orders")
	}
	existing, _ := s.feedbackRepo.GetByOrderID(ctx, orderID)
	if existing != nil {
		return nil, errors.ErrConflict("you have already submitted feedback for this order")
	}
	f := &models.OrderFeedback{
		OrderID: orderID,
		UserID:  userID,
		Rating:  rating,
		Comment: comment,
	}
	if err := s.feedbackRepo.Create(ctx, f); err != nil {
		return nil, err
	}
	return f, nil
}

func (s *orderFeedbackService) GetByOrderID(ctx context.Context, orderID uuid.UUID) (*models.OrderFeedback, error) {
	return s.feedbackRepo.GetByOrderID(ctx, orderID)
}
