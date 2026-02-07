package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/careplus/pharmacy-backend/internal/infrastructure/config"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const chatCustomerTokenExpiry = 24 * time.Hour

type JWTAuthProvider struct {
	cfg *config.Config
}

func NewJWTAuthProvider(cfg *config.Config) *JWTAuthProvider {
	return &JWTAuthProvider{cfg: cfg}
}

var _ outbound.AuthProvider = (*JWTAuthProvider)(nil)

type customClaims struct {
	UserID     string `json:"user_id"`
	PharmacyID string `json:"pharmacy_id"`
	Role       string `json:"role"`
	TokenType  string `json:"token_type"`
	jwt.RegisteredClaims
}

func (j *JWTAuthProvider) GenerateAccessToken(userID, pharmacyID uuid.UUID, role string) (string, error) {
	claims := customClaims{
		UserID:     userID.String(),
		PharmacyID: pharmacyID.String(),
		Role:       role,
		TokenType:  "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(j.cfg.JWT.AccessExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    j.cfg.JWT.Issuer,
			Subject:   userID.String(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(j.cfg.JWT.AccessSecret))
}

func (j *JWTAuthProvider) GenerateRefreshToken(userID uuid.UUID) (string, error) {
	claims := customClaims{
		UserID:    userID.String(),
		TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(j.cfg.JWT.RefreshExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    j.cfg.JWT.Issuer,
			Subject:   userID.String(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(j.cfg.JWT.RefreshSecret))
}

func (j *JWTAuthProvider) ValidateAccessToken(tokenString string) (*outbound.TokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &customClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(j.cfg.JWT.AccessSecret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}
	claims, ok := token.Claims.(*customClaims)
	if !ok || !token.Valid || claims.TokenType != "access" {
		return nil, errors.New("invalid token claims")
	}
	uid, _ := uuid.Parse(claims.UserID)
	pid, _ := uuid.Parse(claims.PharmacyID)
	var exp time.Time
	if claims.ExpiresAt != nil {
		exp = claims.ExpiresAt.Time
	}
	return &outbound.TokenClaims{UserID: uid, PharmacyID: pid, Role: claims.Role, ExpiresAt: exp}, nil
}

func (j *JWTAuthProvider) ValidateRefreshToken(tokenString string) (uuid.UUID, error) {
	token, err := jwt.ParseWithClaims(tokenString, &customClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(j.cfg.JWT.RefreshSecret), nil
	})
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid token: %w", err)
	}
	claims, ok := token.Claims.(*customClaims)
	if !ok || !token.Valid || claims.TokenType != "refresh" {
		return uuid.Nil, errors.New("invalid token claims")
	}
	return uuid.Parse(claims.UserID)
}

type chatCustomerClaims struct {
	PharmacyID string `json:"pharmacy_id"`
	CustomerID string `json:"customer_id"`
	TokenType  string `json:"token_type"`
	jwt.RegisteredClaims
}

func (j *JWTAuthProvider) GenerateChatCustomerToken(pharmacyID, customerID uuid.UUID) (string, error) {
	claims := chatCustomerClaims{
		PharmacyID: pharmacyID.String(),
		CustomerID: customerID.String(),
		TokenType:  "chat_customer",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(chatCustomerTokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    j.cfg.JWT.Issuer,
			Subject:   customerID.String(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(j.cfg.JWT.AccessSecret))
}

func (j *JWTAuthProvider) ValidateChatCustomerToken(tokenString string) (*outbound.ChatCustomerClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &chatCustomerClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(j.cfg.JWT.AccessSecret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}
	claims, ok := token.Claims.(*chatCustomerClaims)
	if !ok || !token.Valid || claims.TokenType != "chat_customer" {
		return nil, errors.New("invalid token claims")
	}
	pid, _ := uuid.Parse(claims.PharmacyID)
	cid, _ := uuid.Parse(claims.CustomerID)
	var exp time.Time
	if claims.ExpiresAt != nil {
		exp = claims.ExpiresAt.Time
	}
	return &outbound.ChatCustomerClaims{PharmacyID: pid, CustomerID: cid, ExpiresAt: exp}, nil
}
