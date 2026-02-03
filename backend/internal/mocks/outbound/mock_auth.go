package mocks

import (
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/google/uuid"
)

// MockAuthProvider is a mock for AuthProvider for unit tests (no DB / no real JWT).
type MockAuthProvider struct {
	GenerateAccessTokenFunc  func(userID, pharmacyID uuid.UUID, role string) (string, error)
	GenerateRefreshTokenFunc func(userID uuid.UUID) (string, error)
	ValidateAccessTokenFunc  func(tokenString string) (*outbound.TokenClaims, error)
	ValidateRefreshTokenFunc func(tokenString string) (uuid.UUID, error)
}

func (m *MockAuthProvider) GenerateAccessToken(userID, pharmacyID uuid.UUID, role string) (string, error) {
	if m.GenerateAccessTokenFunc != nil {
		return m.GenerateAccessTokenFunc(userID, pharmacyID, role)
	}
	return "mock-access-token", nil
}

func (m *MockAuthProvider) GenerateRefreshToken(userID uuid.UUID) (string, error) {
	if m.GenerateRefreshTokenFunc != nil {
		return m.GenerateRefreshTokenFunc(userID)
	}
	return "mock-refresh-token", nil
}

func (m *MockAuthProvider) ValidateAccessToken(tokenString string) (*outbound.TokenClaims, error) {
	if m.ValidateAccessTokenFunc != nil {
		return m.ValidateAccessTokenFunc(tokenString)
	}
	return nil, nil
}

func (m *MockAuthProvider) ValidateRefreshToken(tokenString string) (uuid.UUID, error) {
	if m.ValidateRefreshTokenFunc != nil {
		return m.ValidateRefreshTokenFunc(tokenString)
	}
	return uuid.Nil, nil
}
