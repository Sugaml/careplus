package services

import (
	"context"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
)

const returnRequestWindowDays = 3

type orderReturnRequestService struct {
	orderRepo  outbound.OrderRepository
	returnRepo outbound.OrderReturnRequestRepository
}

func NewOrderReturnRequestService(orderRepo outbound.OrderRepository, returnRepo outbound.OrderReturnRequestRepository) inbound.OrderReturnRequestService {
	return &orderReturnRequestService{orderRepo: orderRepo, returnRepo: returnRepo}
}

func (s *orderReturnRequestService) Create(ctx context.Context, orderID, userID uuid.UUID, videoURL string, photoURLs []string, notes, description string) (*models.OrderReturnRequest, error) {
	o, err := s.orderRepo.GetByID(ctx, orderID)
	if err != nil || o == nil {
		return nil, errors.ErrNotFound("order")
	}
	if o.CreatedBy != userID {
		return nil, errors.ErrForbidden("only the person who placed the order can submit a return request")
	}
	if o.Status != models.OrderStatusCompleted {
		return nil, errors.ErrValidation("return requests are only allowed for completed orders")
	}
	completedAt := o.CompletedAt
	if completedAt == nil {
		completedAt = &o.UpdatedAt
	}
	if time.Since(*completedAt) > returnRequestWindowDays*24*time.Hour {
		return nil, errors.ErrValidation("return requests must be submitted within 3 days of order completion")
	}
	if videoURL == "" && len(photoURLs) == 0 {
		return nil, errors.ErrValidation("please provide at least one video or photo as evidence")
	}
	if notes == "" && description == "" {
		return nil, errors.ErrValidation("please provide notes and description for the return request")
	}
	existing, err := s.returnRepo.GetByOrderID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.ErrConflict("a return request already exists for this order")
	}
	req := &models.OrderReturnRequest{
		OrderID:     orderID,
		UserID:      userID,
		Status:      models.ReturnRequestStatusPending,
		VideoURL:    videoURL,
		PhotoURLs:   models.StringSlice(photoURLs),
		Notes:       notes,
		Description: description,
	}
	if err := s.returnRepo.Create(ctx, req); err != nil {
		return nil, err
	}
	return req, nil
}

func (s *orderReturnRequestService) GetByOrderID(ctx context.Context, orderID uuid.UUID) (*models.OrderReturnRequest, error) {
	return s.returnRepo.GetByOrderID(ctx, orderID)
}
