package services

import (
	"context"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

const reviewWindowDays = 7

type reviewService struct {
	reviewRepo  outbound.ProductReviewRepository
	likeRepo    outbound.ReviewLikeRepository
	commentRepo outbound.ReviewCommentRepository
	productRepo outbound.ProductRepository
	orderRepo   outbound.OrderRepository
	userRepo    outbound.UserRepository
	logger      *zap.Logger
}

func NewReviewService(
	reviewRepo outbound.ProductReviewRepository,
	likeRepo outbound.ReviewLikeRepository,
	commentRepo outbound.ReviewCommentRepository,
	productRepo outbound.ProductRepository,
	orderRepo outbound.OrderRepository,
	userRepo outbound.UserRepository,
	logger *zap.Logger,
) inbound.ReviewService {
	return &reviewService{
		reviewRepo:  reviewRepo,
		likeRepo:    likeRepo,
		commentRepo: commentRepo,
		productRepo: productRepo,
		orderRepo:   orderRepo,
		userRepo:    userRepo,
		logger:      logger,
	}
}

func (s *reviewService) Create(ctx context.Context, userID uuid.UUID, productID uuid.UUID, rating int, title, body string) (*models.ProductReview, error) {
	if rating < 1 || rating > 5 {
		return nil, errors.ErrValidation("rating must be 1-5")
	}
	prod, err := s.productRepo.GetByID(ctx, productID)
	if err != nil || prod == nil {
		return nil, errors.ErrNotFound("product")
	}
	// Reviews only allowed within 7 days of order completion (end users who purchased the product).
	order, err := s.orderRepo.GetLatestCompletedOrderWithProduct(ctx, prod.PharmacyID, userID, productID)
	if err != nil || order == nil {
		return nil, errors.ErrValidation("you can only review products you purchased; complete an order first, then submit a review within 7 days of delivery")
	}
	completedAt := order.CompletedAt
	if completedAt == nil {
		completedAt = &order.UpdatedAt
	}
	if time.Since(*completedAt) > reviewWindowDays*24*time.Hour {
		return nil, errors.ErrValidation("reviews are only allowed within 7 days after order completion")
	}
	exists, err := s.reviewRepo.ExistsByProductAndUser(ctx, productID, userID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.ErrConflict("you have already reviewed this product")
	}
	rev := &models.ProductReview{
		ProductID: productID,
		UserID:    userID,
		Rating:    rating,
		Title:     title,
		Body:      body,
	}
	if err := s.reviewRepo.Create(ctx, rev); err != nil {
		return nil, err
	}
	return rev, nil
}

func (s *reviewService) getMeta(ctx context.Context, rev *models.ProductReview, userID *uuid.UUID) (*inbound.ProductReviewWithMeta, error) {
	likeCount, _ := s.likeRepo.CountByReviewID(ctx, rev.ID)
	userLiked := false
	if userID != nil {
		userLiked, _ = s.likeRepo.Exists(ctx, rev.ID, *userID)
	}
	commentCount, _ := s.commentRepo.CountByReviewID(ctx, rev.ID)
	return &inbound.ProductReviewWithMeta{
		ProductReview: rev,
		LikeCount:      likeCount,
		UserLiked:      userLiked,
		CommentCount:   commentCount,
	}, nil
}

func (s *reviewService) GetByID(ctx context.Context, id uuid.UUID, userID *uuid.UUID) (*inbound.ProductReviewWithMeta, error) {
	rev, err := s.reviewRepo.GetByID(ctx, id)
	if err != nil || rev == nil {
		return nil, errors.ErrNotFound("review")
	}
	return s.getMeta(ctx, rev, userID)
}

func (s *reviewService) ListByProductID(ctx context.Context, productID uuid.UUID, userID *uuid.UUID, limit, offset int) ([]*inbound.ProductReviewWithMeta, error) {
	if limit <= 0 {
		limit = 20
	}
	list, err := s.reviewRepo.ListByProductID(ctx, productID, limit, offset)
	if err != nil {
		return nil, err
	}
	out := make([]*inbound.ProductReviewWithMeta, 0, len(list))
	for _, rev := range list {
		meta, _ := s.getMeta(ctx, rev, userID)
		out = append(out, meta)
	}
	return out, nil
}

func (s *reviewService) Update(ctx context.Context, reviewID, userID uuid.UUID, rating *int, title, body *string) (*models.ProductReview, error) {
	rev, err := s.reviewRepo.GetByID(ctx, reviewID)
	if err != nil || rev == nil {
		return nil, errors.ErrNotFound("review")
	}
	if rev.UserID != userID {
		return nil, errors.ErrForbidden("not your review")
	}
	if rating != nil {
		if *rating < 1 || *rating > 5 {
			return nil, errors.ErrValidation("rating must be 1-5")
		}
		rev.Rating = *rating
	}
	if title != nil {
		rev.Title = *title
	}
	if body != nil {
		rev.Body = *body
	}
	if err := s.reviewRepo.Update(ctx, rev); err != nil {
		return nil, err
	}
	return rev, nil
}

func (s *reviewService) Delete(ctx context.Context, reviewID, userID uuid.UUID) error {
	rev, err := s.reviewRepo.GetByID(ctx, reviewID)
	if err != nil || rev == nil {
		return errors.ErrNotFound("review")
	}
	if rev.UserID != userID {
		return errors.ErrForbidden("not your review")
	}
	return s.reviewRepo.Delete(ctx, reviewID)
}

func (s *reviewService) Like(ctx context.Context, reviewID, userID uuid.UUID) error {
	_, err := s.reviewRepo.GetByID(ctx, reviewID)
	if err != nil {
		return errors.ErrNotFound("review")
	}
	exists, _ := s.likeRepo.Exists(ctx, reviewID, userID)
	if exists {
		return nil // idempotent
	}
	return s.likeRepo.Create(ctx, &models.ReviewLike{ReviewID: reviewID, UserID: userID})
}

func (s *reviewService) Unlike(ctx context.Context, reviewID, userID uuid.UUID) error {
	return s.likeRepo.DeleteByReviewAndUser(ctx, reviewID, userID)
}

func (s *reviewService) CreateComment(ctx context.Context, reviewID, userID uuid.UUID, body string, parentID *uuid.UUID) (*models.ReviewComment, error) {
	if body == "" {
		return nil, errors.ErrValidation("comment body is required")
	}
	_, err := s.reviewRepo.GetByID(ctx, reviewID)
	if err != nil {
		return nil, errors.ErrNotFound("review")
	}
	c := &models.ReviewComment{ReviewID: reviewID, UserID: userID, Body: body, ParentID: parentID}
	if err := s.commentRepo.Create(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *reviewService) ListComments(ctx context.Context, reviewID uuid.UUID, limit, offset int) ([]*models.ReviewComment, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.commentRepo.ListByReviewID(ctx, reviewID, limit, offset)
}

func (s *reviewService) DeleteComment(ctx context.Context, commentID, userID uuid.UUID) error {
	c, err := s.commentRepo.GetByID(ctx, commentID)
	if err != nil || c == nil {
		return errors.ErrNotFound("comment")
	}
	if c.UserID != userID {
		return errors.ErrForbidden("not your comment")
	}
	return s.commentRepo.Delete(ctx, commentID)
}
