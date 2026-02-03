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

func TestPharmacyService_Create_Success(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockPharmacyRepository{}

	var created *models.Pharmacy
	repo.CreateFunc = func(ctx context.Context, p *models.Pharmacy) error {
		created = p
		return nil
	}

	svc := NewPharmacyService(repo, logger)
	p := &models.Pharmacy{Name: "Pharmacy One", LicenseNo: "LIC-001", Address: "123 Main St"}
	err := svc.Create(ctx, p)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if created != p {
		t.Error("expected Create to be called with same pharmacy")
	}
	if created.Name != "Pharmacy One" || created.LicenseNo != "LIC-001" {
		t.Errorf("unexpected pharmacy: %+v", created)
	}
}

func TestPharmacyService_Create_Validation_NameRequired(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockPharmacyRepository{}
	repo.CreateFunc = func(ctx context.Context, p *models.Pharmacy) error {
		t.Fatal("Create should not be called when validation fails")
		return nil
	}

	svc := NewPharmacyService(repo, logger)
	err := svc.Create(ctx, &models.Pharmacy{LicenseNo: "LIC-001"})
	if err == nil {
		t.Fatal("expected validation error for empty name")
	}
	appErr := pkgerrors.GetAppError(err)
	if appErr == nil || appErr.Code != pkgerrors.ErrCodeValidation {
		t.Errorf("expected VALIDATION_ERROR, got %v", err)
	}
}

func TestPharmacyService_Create_Validation_LicenseRequired(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockPharmacyRepository{}
	repo.CreateFunc = func(ctx context.Context, p *models.Pharmacy) error {
		t.Fatal("Create should not be called when validation fails")
		return nil
	}

	svc := NewPharmacyService(repo, logger)
	err := svc.Create(ctx, &models.Pharmacy{Name: "Pharmacy", LicenseNo: ""})
	if err == nil {
		t.Fatal("expected validation error for empty license")
	}
	appErr := pkgerrors.GetAppError(err)
	if appErr == nil || appErr.Code != pkgerrors.ErrCodeValidation {
		t.Errorf("expected VALIDATION_ERROR, got %v", err)
	}
}

func TestPharmacyService_GetByID_Success(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockPharmacyRepository{}

	id := uuid.New()
	expected := &models.Pharmacy{ID: id, Name: "Pharmacy", LicenseNo: "LIC-001"}
	repo.GetByIDFunc = func(ctx context.Context, gotID uuid.UUID) (*models.Pharmacy, error) {
		if gotID == id {
			return expected, nil
		}
		return nil, errors.New("not found")
	}

	svc := NewPharmacyService(repo, logger)
	got, err := svc.GetByID(ctx, id)
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if got != expected {
		t.Errorf("expected %+v, got %+v", expected, got)
	}
}

func TestPharmacyService_List_Success(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockPharmacyRepository{}

	list := []*models.Pharmacy{
		{ID: uuid.New(), Name: "A", LicenseNo: "L1"},
		{ID: uuid.New(), Name: "B", LicenseNo: "L2"},
	}
	repo.ListFunc = func(ctx context.Context) ([]*models.Pharmacy, error) {
		return list, nil
	}

	svc := NewPharmacyService(repo, logger)
	got, err := svc.List(ctx)
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(got) != 2 || got[0] != list[0] || got[1] != list[1] {
		t.Errorf("unexpected list: %+v", got)
	}
}

func TestPharmacyService_Update_Success(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockPharmacyRepository{}

	id := uuid.New()
	var updated *models.Pharmacy
	repo.UpdateFunc = func(ctx context.Context, p *models.Pharmacy) error {
		updated = p
		return nil
	}

	svc := NewPharmacyService(repo, logger)
	p := &models.Pharmacy{ID: id, Name: "Updated", LicenseNo: "LIC-002"}
	err := svc.Update(ctx, p)
	if err != nil {
		t.Fatalf("Update failed: %v", err)
	}
	if updated != p {
		t.Error("expected Update to be called with same pharmacy")
	}
}

func TestPharmacyService_Update_Validation_NoID(t *testing.T) {
	ctx := context.Background()
	logger := zap.NewNop()
	repo := &mocks.MockPharmacyRepository{}
	repo.UpdateFunc = func(ctx context.Context, p *models.Pharmacy) error {
		t.Fatal("Update should not be called when validation fails")
		return nil
	}

	svc := NewPharmacyService(repo, logger)
	err := svc.Update(ctx, &models.Pharmacy{ID: uuid.Nil, Name: "X", LicenseNo: "L"})
	if err == nil {
		t.Fatal("expected validation error for nil ID")
	}
	appErr := pkgerrors.GetAppError(err)
	if appErr == nil || appErr.Code != pkgerrors.ErrCodeValidation {
		t.Errorf("expected VALIDATION_ERROR, got %v", err)
	}
}
