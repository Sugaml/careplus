package services

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type authService struct {
	userRepo     outbound.UserRepository
	pharmacyRepo outbound.PharmacyRepository
	authProvider outbound.AuthProvider
	logger       *zap.Logger
}

func NewAuthService(userRepo outbound.UserRepository, pharmacyRepo outbound.PharmacyRepository, authProvider outbound.AuthProvider, logger *zap.Logger) inbound.AuthService {
	return &authService{userRepo: userRepo, pharmacyRepo: pharmacyRepo, authProvider: authProvider, logger: logger}
}

func (s *authService) Register(ctx context.Context, pharmacyID uuid.UUID, email, password, name, role string) (*models.User, error) {
	_, err := s.userRepo.GetByEmail(ctx, email)
	if err == nil {
		return nil, errors.ErrConflict("email already registered")
	}
	pharmacy, err := s.pharmacyRepo.GetByID(ctx, pharmacyID)
	if err != nil || pharmacy == nil {
		return nil, errors.ErrNotFound("pharmacy")
	}
	u := &models.User{
		PharmacyID: pharmacyID,
		Email:      email,
		Name:       name,
		Role:       role,
		IsActive:   true,
	}
	if err := u.SetPassword(password); err != nil {
		return nil, errors.ErrInternal("failed to hash password", err)
	}
	if err := s.userRepo.Create(ctx, u); err != nil {
		return nil, errors.ErrInternal("failed to create user", err)
	}
	return u, nil
}

func (s *authService) Login(ctx context.Context, email, password string) (accessToken, refreshToken string, user *models.User, err error) {
	u, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil || u == nil {
		return "", "", nil, errors.ErrInvalidCredentials()
	}
	if !u.CheckPassword(password) {
		return "", "", nil, errors.ErrInvalidCredentials()
	}
	if !u.IsActive {
		return "", "", nil, errors.ErrForbidden("account is inactive")
	}
	accessToken, err = s.authProvider.GenerateAccessToken(u.ID, u.PharmacyID, u.Role)
	if err != nil {
		return "", "", nil, errors.ErrInternal("failed to generate token", err)
	}
	refreshToken, err = s.authProvider.GenerateRefreshToken(u.ID)
	if err != nil {
		return "", "", nil, errors.ErrInternal("failed to generate refresh token", err)
	}
	return accessToken, refreshToken, u, nil
}

func (s *authService) RefreshToken(ctx context.Context, refreshToken string) (string, error) {
	userID, err := s.authProvider.ValidateRefreshToken(refreshToken)
	if err != nil {
		return "", errors.ErrUnauthorized("invalid refresh token")
	}
	u, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || u == nil || !u.IsActive {
		return "", errors.ErrUnauthorized("user not found or inactive")
	}
	return s.authProvider.GenerateAccessToken(u.ID, u.PharmacyID, u.Role)
}

func (s *authService) GetCurrentUser(ctx context.Context, userID uuid.UUID) (*models.User, error) {
	return s.userRepo.GetByID(ctx, userID)
}

func (s *authService) UpdateProfile(ctx context.Context, userID uuid.UUID, name string, phone *string, photoURL *string) (*models.User, error) {
	u, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || u == nil {
		return nil, errors.ErrNotFound("user")
	}
	if !u.IsActive {
		return nil, errors.ErrForbidden("account is inactive")
	}
	u.Name = name
	if phone != nil {
		u.Phone = *phone
	}
	if photoURL != nil {
		u.PhotoURL = *photoURL
	}
	if err := s.userRepo.Update(ctx, u); err != nil {
		return nil, errors.ErrInternal("failed to update profile", err)
	}
	return u, nil
}

func (s *authService) ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string) error {
	u, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || u == nil {
		return errors.ErrNotFound("user")
	}
	if !u.IsActive {
		return errors.ErrForbidden("account is inactive")
	}
	if !u.CheckPassword(currentPassword) {
		return errors.ErrInvalidCredentials()
	}
	if err := u.SetPassword(newPassword); err != nil {
		return errors.ErrInternal("failed to hash password", err)
	}
	if err := s.userRepo.Update(ctx, u); err != nil {
		return errors.ErrInternal("failed to update password", err)
	}
	return nil
}
