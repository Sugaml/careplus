package services

import (
	"context"
	"errors"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	pkgerrors "github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const skipAllDuration = 24 * time.Hour

type announcementService struct {
	announcementRepo outbound.AnnouncementRepository
	ackRepo          outbound.AnnouncementAckRepository
	logger           *zap.Logger
}

func NewAnnouncementService(
	announcementRepo outbound.AnnouncementRepository,
	ackRepo outbound.AnnouncementAckRepository,
	logger *zap.Logger,
) *announcementService {
	return &announcementService{
		announcementRepo: announcementRepo,
		ackRepo:          ackRepo,
		logger:           logger,
	}
}

func (s *announcementService) Create(ctx context.Context, pharmacyID uuid.UUID, a *models.Announcement) (*models.Announcement, error) {
	a.PharmacyID = pharmacyID
	if a.DisplaySeconds < models.AnnouncementDisplaySecMin {
		a.DisplaySeconds = models.AnnouncementDisplaySecMin
	}
	if a.DisplaySeconds > models.AnnouncementDisplaySecMax {
		a.DisplaySeconds = models.AnnouncementDisplaySecMax
	}
	if a.ValidDays <= 0 {
		a.ValidDays = 7
	}
	if a.Template == "" {
		a.Template = models.AnnouncementTemplateCelebration
	}
	if err := s.announcementRepo.Create(ctx, a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *announcementService) GetByID(ctx context.Context, id uuid.UUID) (*models.Announcement, error) {
	a, err := s.announcementRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, pkgerrors.ErrNotFound("announcement")
		}
		return nil, err
	}
	return a, nil
}

func (s *announcementService) ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, activeOnly bool) ([]*models.Announcement, error) {
	return s.announcementRepo.ListByPharmacy(ctx, pharmacyID, activeOnly)
}

func (s *announcementService) Update(ctx context.Context, pharmacyID uuid.UUID, a *models.Announcement) (*models.Announcement, error) {
	existing, err := s.announcementRepo.GetByID(ctx, a.ID)
	if err != nil {
		return nil, err
	}
	if existing.PharmacyID != pharmacyID {
		return nil, pkgerrors.ErrNotFound("announcement")
	}
	if a.DisplaySeconds >= models.AnnouncementDisplaySecMin && a.DisplaySeconds <= models.AnnouncementDisplaySecMax {
		existing.DisplaySeconds = a.DisplaySeconds
	}
	if a.ValidDays > 0 {
		existing.ValidDays = a.ValidDays
	}
	existing.Type = a.Type
	existing.Template = a.Template
	existing.Title = a.Title
	existing.Body = a.Body
	existing.ImageURL = a.ImageURL
	existing.LinkURL = a.LinkURL
	existing.ShowTerms = a.ShowTerms
	existing.TermsText = a.TermsText
	existing.AllowSkipAll = a.AllowSkipAll
	existing.StartAt = a.StartAt
	existing.EndAt = a.EndAt
	existing.SortOrder = a.SortOrder
	existing.IsActive = a.IsActive
	if err := s.announcementRepo.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *announcementService) Delete(ctx context.Context, pharmacyID, id uuid.UUID) error {
	existing, err := s.announcementRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if existing.PharmacyID != pharmacyID {
		return pkgerrors.ErrNotFound("announcement")
	}
	return s.announcementRepo.Delete(ctx, id)
}

// effectiveEnd returns the time after which the announcement should no longer be shown.
func effectiveEnd(a *models.Announcement) time.Time {
	var start time.Time
	if a.StartAt != nil {
		start = *a.StartAt
	} else {
		start = a.CreatedAt
	}
	validUntil := start.AddDate(0, 0, a.ValidDays)
	if a.EndAt != nil && a.EndAt.Before(validUntil) {
		return *a.EndAt
	}
	return validUntil
}

func (s *announcementService) ListActiveForUser(ctx context.Context, pharmacyID, userID uuid.UUID) ([]*models.Announcement, error) {
	skipAllSince := time.Now().Add(-skipAllDuration)
	skipped, err := s.ackRepo.HasSkippedAllSince(ctx, userID, skipAllSince)
	if err != nil {
		return nil, err
	}
	if skipped {
		return nil, nil
	}
	list, err := s.announcementRepo.ListByPharmacy(ctx, pharmacyID, true)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	var out []*models.Announcement
	for _, a := range list {
		if now.After(effectiveEnd(a)) {
			continue
		}
		acked, err := s.ackRepo.HasAcked(ctx, userID, a.ID)
		if err != nil {
			continue
		}
		if acked {
			continue
		}
		out = append(out, a)
	}
	return out, nil
}

func (s *announcementService) Acknowledge(ctx context.Context, userID, announcementID uuid.UUID, skipAll bool) error {
	ack := &models.AnnouncementAck{
		UserID:         userID,
		AcknowledgedAt: time.Now(),
		SkipAll:        skipAll,
	}
	if skipAll {
		ack.AnnouncementID = nil
	} else {
		ack.AnnouncementID = &announcementID
	}
	return s.ackRepo.Create(ctx, ack)
}
