package main

import (
	"context"
	"log"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/infrastructure/config"
	"github.com/careplus/pharmacy-backend/internal/infrastructure/database"
	"github.com/careplus/pharmacy-backend/internal/infrastructure/logger"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// Test user credentials (used by seed and by frontend quick login).
const (
	SeedTestPassword = "password123"

	SeedAdminEmail      = "admin@careplus.com"
	SeedManagerEmail    = "manager@careplus.com"
	SeedPharmacistEmail = "pharmacist@careplus.com"
	SeedBuyerEmail      = "buyer@careplus.com"
	SeedTestEmail       = "test@careplus.com" // legacy; same as admin
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	zapLogger, err := logger.NewZapLogger(cfg.Server.Environment)
	if err != nil {
		log.Fatalf("Failed to create logger: %v", err)
	}

	db, cleanup, err := database.NewPostgresConnection(cfg, zapLogger)
	if err != nil {
		zapLogger.Fatal("Failed to connect to database", zap.Error(err))
	}
	defer cleanup()

	ctx := context.Background()
	if err := runSeed(ctx, db, zapLogger); err != nil {
		zapLogger.Fatal("Seed failed", zap.Error(err))
	}
	zapLogger.Info("Seed completed successfully",
		zap.String("admin", SeedAdminEmail),
		zap.String("pharmacist", SeedPharmacistEmail),
		zap.String("buyer", SeedBuyerEmail),
		zap.String("password", SeedTestPassword))
}

func runSeed(ctx context.Context, db *gorm.DB, log *zap.Logger) error {
	// Create demo pharmacy if not exists
	var pharmacy models.Pharmacy
	err := db.WithContext(ctx).Where("license_no = ?", "DEMO-LICENSE-001").First(&pharmacy).Error
	if err == gorm.ErrRecordNotFound {
		pharmacy = models.Pharmacy{
			Name:          "CarePlus Demo Pharmacy",
			LicenseNo:     "DEMO-LICENSE-001",
			TenantCode:    "careplus",
			HostnameSlug:  "careplus",
			BusinessType:  models.BusinessTypePharmacy,
			Address:       "123 Demo Street, Kathmandu",
			Phone:         "+977 1 2345678",
			Email:         "demo@careplus.com",
			IsActive:      true,
		}
		if err := db.WithContext(ctx).Create(&pharmacy).Error; err != nil {
			return err
		}
		log.Info("Created demo pharmacy", zap.String("id", pharmacy.ID.String()))
	} else if err != nil {
		return err
	} else if pharmacy.TenantCode == "" || pharmacy.HostnameSlug == "" || pharmacy.BusinessType == "" {
		// Backfill for existing DBs after app-config migration
		if pharmacy.TenantCode == "" {
			pharmacy.TenantCode = "careplus"
		}
		if pharmacy.HostnameSlug == "" {
			pharmacy.HostnameSlug = "careplus"
		}
		if pharmacy.BusinessType == "" {
			pharmacy.BusinessType = models.BusinessTypePharmacy
		}
		if err := db.WithContext(ctx).Save(&pharmacy).Error; err != nil {
			return err
		}
		log.Info("Updated demo pharmacy with tenant_code, hostname_slug, business_type")
	}

	// Ensure demo pharmacy has config for /app-config (company_name, theme, language, address)
	var config models.PharmacyConfig
	err = db.WithContext(ctx).Where("pharmacy_id = ?", pharmacy.ID).First(&config).Error
	if err == gorm.ErrRecordNotFound {
		config = models.PharmacyConfig{
			PharmacyID:      pharmacy.ID,
			DisplayName:     "Care+ Pharmacy",
			Location:        pharmacy.Address,
			PrimaryColor:    "#0d9488",
			DefaultLanguage: "en",
			WebsiteEnabled:  true,
			FeatureFlags:    models.DefaultFeatureFlags(),
		}
		if err := db.WithContext(ctx).Create(&config).Error; err != nil {
			return err
		}
		log.Info("Created demo pharmacy config for app-config")
	} else if err != nil {
		return err
	}

	// Seed users for quick login: admin, manager, pharmacist, end user (buyer)
	seedUsers := []struct {
		email string
		name  string
		role  string
	}{
		{SeedAdminEmail, "Admin User", "admin"},
		{SeedManagerEmail, "Manager User", "manager"},
		{SeedPharmacistEmail, "Pharmacist User", "pharmacist"},
		{SeedBuyerEmail, "End User (Buyer)", "staff"},
		{SeedTestEmail, "Test User", "admin"}, // legacy
	}
	seen := make(map[string]bool)
	for _, su := range seedUsers {
		if seen[su.email] {
			continue
		}
		seen[su.email] = true
		var user models.User
		err := db.WithContext(ctx).Where("email = ?", su.email).First(&user).Error
		if err == gorm.ErrRecordNotFound {
			user = models.User{
				PharmacyID: pharmacy.ID,
				Email:      su.email,
				Name:       su.name,
				Role:       su.role,
				IsActive:   true,
			}
			if err := user.SetPassword(SeedTestPassword); err != nil {
				return err
			}
			if err := db.WithContext(ctx).Create(&user).Error; err != nil {
				return err
			}
			log.Info("Created seed user", zap.String("email", su.email), zap.String("role", su.role))
		} else if err != nil {
			return err
		}
	}
	log.Info("Seed users ready", zap.String("password", SeedTestPassword))
	return nil
}
