package services

import (
	"context"
	"strings"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type pharmacyConfigService struct {
	configRepo   outbound.PharmacyConfigRepository
	pharmacyRepo outbound.PharmacyRepository
	logger       *zap.Logger
}

func NewPharmacyConfigService(configRepo outbound.PharmacyConfigRepository, pharmacyRepo outbound.PharmacyRepository, logger *zap.Logger) inbound.PharmacyConfigService {
	return &pharmacyConfigService{configRepo: configRepo, pharmacyRepo: pharmacyRepo, logger: logger}
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
	// Create default config with default feature flags
	c = &models.PharmacyConfig{PharmacyID: pharmacyID, FeatureFlags: models.DefaultFeatureFlags()}
	if err := s.configRepo.Create(ctx, c); err != nil {
		return nil, errors.ErrInternal("failed to create config", err)
	}
	return c, nil
}

// normalizeHostname returns a slug for lookup: strip port, lowercase, use first label (subdomain) or full host.
func normalizeHostname(host string) string {
	host = strings.TrimSpace(host)
	if i := strings.Index(host, ":"); i >= 0 {
		host = host[:i]
	}
	host = strings.ToLower(host)
	parts := strings.Split(host, ".")
	if len(parts) > 1 {
		return parts[0]
	}
	return host
}

func (s *pharmacyConfigService) GetAppConfigByHostname(ctx context.Context, hostname string) (*inbound.AppConfigResponse, error) {
	slug := normalizeHostname(hostname)
	if slug == "" {
		return nil, errors.ErrValidation("hostname is required")
	}
	pharmacy, err := s.pharmacyRepo.GetByHostnameSlug(ctx, slug)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, errors.ErrNotFound("tenant")
		}
		return nil, err
	}
	cfg, err := s.GetOrCreateByPharmacyID(ctx, pharmacy.ID)
	if err != nil {
		return nil, err
	}
	resp := &inbound.AppConfigResponse{
		CompanyName:    cfg.DisplayName,
		DefaultTheme:   cfg.PrimaryColor,
		Language:       cfg.DefaultLanguage,
		Address:        cfg.Location,
		TenantCode:     pharmacy.TenantCode,
		PharmacyID:     pharmacy.ID.String(),
		BusinessType:   pharmacy.BusinessType,
		WebsiteEnabled: cfg.WebsiteEnabled,
		Features:       cfg.FeatureFlags,
		LogoURL:        cfg.LogoURL,
		Tagline:        cfg.Tagline,
		ContactPhone:   cfg.ContactPhone,
		ContactEmail:   cfg.ContactEmail,
	}
	if resp.BusinessType == "" {
		resp.BusinessType = models.BusinessTypePharmacy
	}
	if resp.Language == "" {
		resp.Language = "en"
	}
	if len(resp.Features) == 0 {
		resp.Features = models.DefaultFeatureFlags()
	}
	if cfg.VerifiedAt != nil {
		s := cfg.VerifiedAt.Format("2006-01-02T15:04:05Z07:00")
		resp.VerifiedAt = &s
	}
	return resp, nil
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
	dst.DefaultLanguage = src.DefaultLanguage
	dst.WebsiteEnabled = src.WebsiteEnabled
	if len(src.FeatureFlags) > 0 {
		dst.FeatureFlags = src.FeatureFlags
	}
	dst.LicenseNo = src.LicenseNo
	dst.VerifiedAt = src.VerifiedAt
	dst.EstablishedYear = src.EstablishedYear
	dst.ReturnRefundPolicy = src.ReturnRefundPolicy
	dst.ChatEditWindowMinutes = src.ChatEditWindowMinutes
}
