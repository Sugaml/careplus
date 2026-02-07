package outbound

//go:generate mockgen -source=auth.go -destination=../../mocks/outbound/auth_mock_gen.go -package=mocks
// Run from repo root: go generate ./internal/ports/outbound/...

import (
	"time"

	"github.com/google/uuid"
)

type TokenClaims struct {
	UserID     uuid.UUID
	PharmacyID uuid.UUID
	Role       string
	ExpiresAt  time.Time
}

// ChatCustomerClaims is used for customer chat access (short-lived token).
type ChatCustomerClaims struct {
	PharmacyID uuid.UUID
	CustomerID uuid.UUID
	ExpiresAt  time.Time
}

type AuthProvider interface {
	GenerateAccessToken(userID, pharmacyID uuid.UUID, role string) (string, error)
	GenerateRefreshToken(userID uuid.UUID) (string, error)
	ValidateAccessToken(tokenString string) (*TokenClaims, error)
	ValidateRefreshToken(tokenString string) (userID uuid.UUID, err error)
	GenerateChatCustomerToken(pharmacyID, customerID uuid.UUID) (string, error)
	ValidateChatCustomerToken(tokenString string) (*ChatCustomerClaims, error)
}
