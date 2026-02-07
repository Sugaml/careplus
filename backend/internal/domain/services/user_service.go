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

func applyPharmacistProfile(u *models.User, p *inbound.PharmacistProfileInput) {
	if p == nil {
		return
	}
	if p.LicenseNumber != nil {
		u.LicenseNumber = *p.LicenseNumber
	}
	if p.Qualification != nil {
		u.Qualification = *p.Qualification
	}
	if p.CVURL != nil {
		u.CVURL = *p.CVURL
	}
	if p.PhotoURL != nil {
		u.PhotoURL = *p.PhotoURL
	}
	if p.DateOfBirth != nil {
		u.DateOfBirth = p.DateOfBirth
	}
	if p.Gender != nil {
		u.Gender = *p.Gender
	}
	if p.Phone != nil {
		u.Phone = *p.Phone
	}
}

const (
	RoleAdmin      = "admin"
	RoleManager    = "manager"
	RolePharmacist = "pharmacist"
	RoleStaff      = "staff"
)

type userService struct {
	userRepo     outbound.UserRepository
	pharmacyRepo outbound.PharmacyRepository
	logger       *zap.Logger
}

func NewUserService(userRepo outbound.UserRepository, pharmacyRepo outbound.PharmacyRepository, logger *zap.Logger) inbound.UserService {
	return &userService{userRepo: userRepo, pharmacyRepo: pharmacyRepo, logger: logger}
}

func (s *userService) List(ctx context.Context, pharmacyID uuid.UUID, actorRole string) ([]*models.User, error) {
	list, err := s.userRepo.GetByPharmacyID(ctx, pharmacyID)
	if err != nil {
		return nil, err
	}
	if actorRole == RoleManager {
		filtered := make([]*models.User, 0, len(list))
		for _, u := range list {
			if u.Role == RolePharmacist {
				filtered = append(filtered, u)
			}
		}
		return filtered, nil
	}
	return list, nil
}

func (s *userService) Create(ctx context.Context, pharmacyID uuid.UUID, actorRole string, email, password, name, role string, pharmacist *inbound.PharmacistProfileInput) (*models.User, error) {
	if role == "" {
		role = RoleStaff
	}
	if actorRole == RoleManager {
		if role != RolePharmacist {
			return nil, errors.ErrForbidden("manager can only create pharmacists")
		}
	} else if actorRole != RoleAdmin {
		return nil, errors.ErrForbidden("only admin or manager can create users")
	}
	if role == RoleAdmin {
		return nil, errors.ErrForbidden("cannot create admin users via this endpoint")
	}
	allowedRoles := map[string]bool{RoleManager: true, RolePharmacist: true, RoleStaff: true}
	if !allowedRoles[role] {
		return nil, errors.ErrForbidden("invalid role")
	}

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
	if role == RolePharmacist && pharmacist != nil {
		applyPharmacistProfile(u, pharmacist)
	}
	if err := u.SetPassword(password); err != nil {
		return nil, errors.ErrInternal("failed to hash password", err)
	}
	if err := s.userRepo.Create(ctx, u); err != nil {
		return nil, errors.ErrInternal("failed to create user", err)
	}
	return u, nil
}

func (s *userService) GetByID(ctx context.Context, pharmacyID uuid.UUID, actorRole string, userID uuid.UUID) (*models.User, error) {
	u, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || u == nil {
		return nil, errors.ErrNotFound("user")
	}
	if u.PharmacyID != pharmacyID {
		return nil, errors.ErrNotFound("user")
	}
	if actorRole == RoleManager && u.Role != RolePharmacist {
		return nil, errors.ErrForbidden("manager can only view pharmacists")
	}
	return u, nil
}

func (s *userService) Update(ctx context.Context, pharmacyID uuid.UUID, actorRole string, userID uuid.UUID, name string, role *string, isActive *bool, pharmacist *inbound.PharmacistProfileInput) (*models.User, error) {
	u, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || u == nil {
		return nil, errors.ErrNotFound("user")
	}
	if u.PharmacyID != pharmacyID {
		return nil, errors.ErrNotFound("user")
	}
	if actorRole == RoleManager {
		if u.Role != RolePharmacist {
			return nil, errors.ErrForbidden("manager can only update pharmacists")
		}
		if role != nil && *role != RolePharmacist {
			return nil, errors.ErrForbidden("manager cannot change role to non-pharmacist")
		}
	} else if actorRole != RoleAdmin {
		return nil, errors.ErrForbidden("only admin or manager can update users")
	}
	if role != nil {
		if *role == RoleAdmin {
			return nil, errors.ErrForbidden("cannot set role to admin")
		}
		u.Role = *role
	}
	if name != "" {
		u.Name = name
	}
	if isActive != nil {
		u.IsActive = *isActive
	}
	if u.Role == RolePharmacist && pharmacist != nil {
		applyPharmacistProfile(u, pharmacist)
	}
	if err := s.userRepo.Update(ctx, u); err != nil {
		return nil, errors.ErrInternal("failed to update user", err)
	}
	return u, nil
}

func (s *userService) Deactivate(ctx context.Context, pharmacyID uuid.UUID, actorRole string, userID uuid.UUID) (*models.User, error) {
	u, err := s.userRepo.GetByID(ctx, userID)
	if err != nil || u == nil {
		return nil, errors.ErrNotFound("user")
	}
	if u.PharmacyID != pharmacyID {
		return nil, errors.ErrNotFound("user")
	}
	if actorRole == RoleManager && u.Role != RolePharmacist {
		return nil, errors.ErrForbidden("manager can only deactivate pharmacists")
	}
	if actorRole != RoleAdmin && actorRole != RoleManager {
		return nil, errors.ErrForbidden("only admin or manager can deactivate users")
	}
	u.IsActive = false
	if err := s.userRepo.Update(ctx, u); err != nil {
		return nil, errors.ErrInternal("failed to deactivate user", err)
	}
	return u, nil
}
