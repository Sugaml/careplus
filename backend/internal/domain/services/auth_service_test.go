package services

import (
	"context"
	"errors"
	"testing"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/mocks/outbound"
	pkgerrors "github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

func TestAuthService_Register_Success(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	userRepo := &mocks.MockUserRepository{}
	pharmacyRepo := &mocks.MockPharmacyRepository{}
	authProvider := &mocks.MockAuthProvider{}

	pharmacyID := uuid.New()
	pharmacy := &models.Pharmacy{ID: pharmacyID, Name: "Test Pharmacy", LicenseNo: "LIC-001"}

	userRepo.GetByEmailFunc = func(ctx context.Context, email string) (*models.User, error) {
		return nil, errors.New("not found") // email not taken
	}
	pharmacyRepo.GetByIDFunc = func(ctx context.Context, id uuid.UUID) (*models.Pharmacy, error) {
		if id == pharmacyID {
			return pharmacy, nil
		}
		return nil, errors.New("not found")
	}
	userRepo.CreateFunc = func(ctx context.Context, u *models.User) error {
		if u.Email != "user@example.com" || u.PharmacyID != pharmacyID {
			t.Fatalf("unexpected user: %+v", u)
		}
		return nil
	}

	svc := NewAuthService(userRepo, pharmacyRepo, authProvider, logger)
	user, err := svc.Register(ctx, pharmacyID, "user@example.com", "password123", "Test User", "staff")
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}
	if user == nil {
		t.Fatal("expected user, got nil")
	}
	if user.Email != "user@example.com" || user.PharmacyID != pharmacyID {
		t.Errorf("unexpected user: %+v", user)
	}
}

func TestAuthService_Register_EmailAlreadyExists(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	userRepo := &mocks.MockUserRepository{}
	pharmacyRepo := &mocks.MockPharmacyRepository{}
	authProvider := &mocks.MockAuthProvider{}

	userRepo.GetByEmailFunc = func(ctx context.Context, email string) (*models.User, error) {
		return &models.User{Email: email}, nil // user already exists
	}

	svc := NewAuthService(userRepo, pharmacyRepo, authProvider, logger)
	user, err := svc.Register(ctx, uuid.New(), "existing@example.com", "pass", "Name", "staff")
	if err == nil {
		t.Fatal("expected conflict error, got nil")
	}
	if user != nil {
		t.Fatal("expected nil user on conflict")
	}
	appErr := pkgerrors.GetAppError(err)
	if appErr == nil || appErr.Code != pkgerrors.ErrCodeConflict {
		t.Errorf("expected CONFLICT error, got %v", err)
	}
}

func TestAuthService_Register_PharmacyNotFound(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	userRepo := &mocks.MockUserRepository{}
	pharmacyRepo := &mocks.MockPharmacyRepository{}
	authProvider := &mocks.MockAuthProvider{}

	userRepo.GetByEmailFunc = func(ctx context.Context, email string) (*models.User, error) {
		return nil, errors.New("not found")
	}
	pharmacyRepo.GetByIDFunc = func(ctx context.Context, id uuid.UUID) (*models.Pharmacy, error) {
		return nil, errors.New("not found")
	}

	svc := NewAuthService(userRepo, pharmacyRepo, authProvider, logger)
	user, err := svc.Register(ctx, uuid.New(), "new@example.com", "pass", "Name", "staff")
	if err == nil {
		t.Fatal("expected pharmacy not found error, got nil")
	}
	if user != nil {
		t.Fatal("expected nil user")
	}
	appErr := pkgerrors.GetAppError(err)
	if appErr == nil || appErr.Code != pkgerrors.ErrCodeNotFound {
		t.Errorf("expected NOT_FOUND error, got %v", err)
	}
}

func TestAuthService_Login_Success(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	userRepo := &mocks.MockUserRepository{}
	pharmacyRepo := &mocks.MockPharmacyRepository{}
	authProvider := &mocks.MockAuthProvider{}

	u := &models.User{
		ID:         uuid.New(),
		PharmacyID: uuid.New(),
		Email:      "login@example.com",
		Name:       "User",
		Role:       "staff",
		IsActive:   true,
	}
	_ = u.SetPassword("secret")

	userRepo.GetByEmailFunc = func(ctx context.Context, email string) (*models.User, error) {
		if email == "login@example.com" {
			return u, nil
		}
		return nil, errors.New("not found")
	}
	authProvider.GenerateAccessTokenFunc = func(userID, pharmacyID uuid.UUID, role string) (string, error) {
		return "access-token", nil
	}
	authProvider.GenerateRefreshTokenFunc = func(userID uuid.UUID) (string, error) {
		return "refresh-token", nil
	}

	svc := NewAuthService(userRepo, pharmacyRepo, authProvider, logger)
	access, refresh, user, err := svc.Login(ctx, "login@example.com", "secret")
	if err != nil {
		t.Fatalf("Login failed: %v", err)
	}
	if access != "access-token" || refresh != "refresh-token" {
		t.Errorf("unexpected tokens: access=%q refresh=%q", access, refresh)
	}
	if user == nil || user.Email != "login@example.com" {
		t.Errorf("unexpected user: %+v", user)
	}
}

func TestAuthService_Login_InvalidCredentials(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	userRepo := &mocks.MockUserRepository{}
	pharmacyRepo := &mocks.MockPharmacyRepository{}
	authProvider := &mocks.MockAuthProvider{}

	userRepo.GetByEmailFunc = func(ctx context.Context, email string) (*models.User, error) {
		return nil, errors.New("not found")
	}

	svc := NewAuthService(userRepo, pharmacyRepo, authProvider, logger)
	_, _, user, err := svc.Login(ctx, "nonexistent@example.com", "any")
	if err == nil {
		t.Fatal("expected invalid credentials error, got nil")
	}
	if user != nil {
		t.Fatal("expected nil user")
	}
	appErr := pkgerrors.GetAppError(err)
	if appErr == nil || appErr.Code != pkgerrors.ErrCodeInvalidCredentials {
		t.Errorf("expected INVALID_CREDENTIALS error, got %v", err)
	}
}

func TestAuthService_GetCurrentUser_Success(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	userRepo := &mocks.MockUserRepository{}
	pharmacyRepo := &mocks.MockPharmacyRepository{}
	authProvider := &mocks.MockAuthProvider{}

	userID := uuid.New()
	expected := &models.User{ID: userID, Email: "me@example.com", Name: "Me"}
	userRepo.GetByIDFunc = func(ctx context.Context, id uuid.UUID) (*models.User, error) {
		if id == userID {
			return expected, nil
		}
		return nil, errors.New("not found")
	}

	svc := NewAuthService(userRepo, pharmacyRepo, authProvider, logger)
	user, err := svc.GetCurrentUser(ctx, userID)
	if err != nil {
		t.Fatalf("GetCurrentUser failed: %v", err)
	}
	if user != expected {
		t.Errorf("expected user %+v, got %+v", expected, user)
	}
}
