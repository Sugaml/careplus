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
)

type userAddressService struct {
	repo   outbound.UserAddressRepository
	logger *zap.Logger
}

func NewUserAddressService(repo outbound.UserAddressRepository, logger *zap.Logger) inbound.UserAddressService {
	return &userAddressService{repo: repo, logger: logger}
}

func (s *userAddressService) ListByUser(ctx context.Context, userID uuid.UUID) ([]*models.UserAddress, error) {
	list, err := s.repo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, errors.ErrInternal("failed to list addresses", err)
	}
	return list, nil
}

func (s *userAddressService) Create(ctx context.Context, userID uuid.UUID, label, line1, line2, city, state, postalCode, country, phone string, setAsDefault bool) (*models.UserAddress, error) {
	line1 = strings.TrimSpace(line1)
	if line1 == "" {
		return nil, errors.ErrValidation("address line 1 is required")
	}
	city = strings.TrimSpace(city)
	if city == "" {
		return nil, errors.ErrValidation("city is required")
	}
	country = strings.TrimSpace(country)
	if country == "" {
		return nil, errors.ErrValidation("country is required")
	}
	if setAsDefault {
		if err := s.repo.ClearDefaultByUserID(ctx, userID); err != nil {
			return nil, errors.ErrInternal("failed to clear default address", err)
		}
	}
	// If this is the first address, make it default
	list, _ := s.repo.ListByUserID(ctx, userID)
	isFirst := len(list) == 0
	if isFirst {
		setAsDefault = true
	}
	a := &models.UserAddress{
		UserID:     userID,
		Label:      strings.TrimSpace(label),
		Line1:     line1,
		Line2:     strings.TrimSpace(line2),
		City:      city,
		State:     strings.TrimSpace(state),
		PostalCode: strings.TrimSpace(postalCode),
		Country:   country,
		Phone:     strings.TrimSpace(phone),
		IsDefault: setAsDefault,
	}
	if err := s.repo.Create(ctx, a); err != nil {
		return nil, errors.ErrInternal("failed to create address", err)
	}
	return a, nil
}

func (s *userAddressService) Update(ctx context.Context, userID uuid.UUID, id uuid.UUID, label, line1, line2, city, state, postalCode, country, phone *string, setAsDefault *bool) (*models.UserAddress, error) {
	a, err := s.repo.GetByID(ctx, id)
	if err != nil || a == nil {
		return nil, errors.ErrNotFound("address")
	}
	if a.UserID != userID {
		return nil, errors.ErrForbidden("address does not belong to user")
	}
	if line1 != nil {
		v := strings.TrimSpace(*line1)
		if v == "" {
			return nil, errors.ErrValidation("address line 1 is required")
		}
		a.Line1 = v
	}
	if line2 != nil {
		a.Line2 = strings.TrimSpace(*line2)
	}
	if city != nil {
		v := strings.TrimSpace(*city)
		if v == "" {
			return nil, errors.ErrValidation("city is required")
		}
		a.City = v
	}
	if state != nil {
		a.State = strings.TrimSpace(*state)
	}
	if postalCode != nil {
		a.PostalCode = strings.TrimSpace(*postalCode)
	}
	if country != nil {
		v := strings.TrimSpace(*country)
		if v == "" {
			return nil, errors.ErrValidation("country is required")
		}
		a.Country = v
	}
	if phone != nil {
		a.Phone = strings.TrimSpace(*phone)
	}
	if label != nil {
		a.Label = strings.TrimSpace(*label)
	}
	if setAsDefault != nil && *setAsDefault {
		if err := s.repo.ClearDefaultByUserID(ctx, userID); err != nil {
			return nil, errors.ErrInternal("failed to clear default address", err)
		}
		a.IsDefault = true
	}
	if err := s.repo.Update(ctx, a); err != nil {
		return nil, errors.ErrInternal("failed to update address", err)
	}
	return a, nil
}

func (s *userAddressService) Delete(ctx context.Context, userID uuid.UUID, id uuid.UUID) error {
	a, err := s.repo.GetByID(ctx, id)
	if err != nil || a == nil {
		return errors.ErrNotFound("address")
	}
	if a.UserID != userID {
		return errors.ErrForbidden("address does not belong to user")
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return errors.ErrInternal("failed to delete address", err)
	}
	// If we deleted the default, set another as default
	if a.IsDefault {
		list, _ := s.repo.ListByUserID(ctx, userID)
		if len(list) > 0 {
			first := list[0]
			first.IsDefault = true
			_ = s.repo.Update(ctx, first)
		}
	}
	return nil
}

func (s *userAddressService) SetDefault(ctx context.Context, userID uuid.UUID, id uuid.UUID) (*models.UserAddress, error) {
	a, err := s.repo.GetByID(ctx, id)
	if err != nil || a == nil {
		return nil, errors.ErrNotFound("address")
	}
	if a.UserID != userID {
		return nil, errors.ErrForbidden("address does not belong to user")
	}
	if err := s.repo.ClearDefaultByUserID(ctx, userID); err != nil {
		return nil, errors.ErrInternal("failed to clear default address", err)
	}
	a.IsDefault = true
	if err := s.repo.Update(ctx, a); err != nil {
		return nil, errors.ErrInternal("failed to set default address", err)
	}
	return a, nil
}
