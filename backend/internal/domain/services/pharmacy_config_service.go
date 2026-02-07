package services

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type pharmacyConfigService struct {
	configRepo outbound.PharmacyConfigRepository
	logger     *zap.Logger
}

func NewPharmacyConfigService(configRepo outbound.PharmacyConfigRepository, logger *zap.Logger) inbound.PharmacyConfigService {
	return &pharmacyConfigService{configRepo: configRepo, logger: logger}
}

func (s *pharmacyConfigService) GetByPharmacyID(ctx context.Context, pharmacyID uuid.UUID) (*models.PharmacyConfig, error) {
	return s.configRepo.GetByPharmacyID(ctx, pharmacyID)
}

func (s *pharmacyConfigService) GetOrCreateByPharmacyID(ctx context.Context, pharmacyID uuid.UUID) (*models.PharmacyConfig, error) {
	c, err := s.configRepo.GetByPharmacyID(ctx, pharmacyID)
	if err == nil {
		return c, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}
	// Create default config
	c = &models.PharmacyConfig{PharmacyID: pharmacyID}
	if err := s.configRepo.Create(ctx, c); err != nil {
		return nil, errors.ErrInternal("failed to create config", err)
	}
	return c, nil
}

func (s *pharmacyConfigService) Upsert(ctx context.Context, pharmacyID uuid.UUID, input *models.PharmacyConfig) (*models.PharmacyConfig, error) {
	c, err := s.configRepo.GetByPharmacyID(ctx, pharmacyID)
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}
	if err == gorm.ErrRecordNotFound || c == nil {
		c = &models.PharmacyConfig{PharmacyID: pharmacyID}
		applyInput(c, input)
		if err := s.configRepo.Create(ctx, c); err != nil {
			return nil, errors.ErrInternal("failed to create config", err)
		}
		return c, nil
	}
	applyInput(c, input)
	if err := s.configRepo.Update(ctx, c); err != nil {
		return nil, errors.ErrInternal("failed to update config", err)
	}
	return c, nil
}

func applyInput(dst *models.PharmacyConfig, src *models.PharmacyConfig) {
	dst.DisplayName = src.DisplayName
	dst.Location = src.Location
	dst.LogoURL = src.LogoURL
	dst.BannerURL = src.BannerURL
	dst.Tagline = src.Tagline
	dst.ContactPhone = src.ContactPhone
	dst.ContactEmail = src.ContactEmail
	dst.PrimaryColor = src.PrimaryColor
	dst.LicenseNo = src.LicenseNo
	dst.VerifiedAt = src.VerifiedAt
	dst.EstablishedYear = src.EstablishedYear
	dst.ReturnRefundPolicy = src.ReturnRefundPolicy
	dst.ChatEditWindowMinutes = src.ChatEditWindowMinutes
}
