package seed

import (
	"context"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// Demo user credentials (same as frontend quick login).
const (
	DemoPassword        = "password123"
	DemoAdminEmail      = "admin@careplus.com"
	DemoManagerEmail    = "manager@careplus.com"
	DemoPharmacistEmail = "pharmacist@careplus.com"
	DemoBuyerEmail      = "buyer@careplus.com"
	DemoTestEmail       = "test@careplus.com"
)

// EnsureDemoUsers creates the demo pharmacy and demo users (admin, pharmacist, buyer, test) if they do not exist.
// Safe to call on every API startup; idempotent.
func EnsureDemoUsers(ctx context.Context, db *gorm.DB, log *zap.Logger) error {
	var pharmacy models.Pharmacy
	err := db.WithContext(ctx).Where("license_no = ?", "DEMO-LICENSE-001").First(&pharmacy).Error
	if err == gorm.ErrRecordNotFound {
		pharmacy = models.Pharmacy{
			Name:      "CarePlus Demo Pharmacy",
			LicenseNo: "DEMO-LICENSE-001",
			Address:   "123 Demo Street, Kathmandu",
			Phone:     "+977 1 2345678",
			Email:     "demo@careplus.com",
			IsActive:  true,
		}
		if err := db.WithContext(ctx).Create(&pharmacy).Error; err != nil {
			return err
		}
		log.Info("Created demo pharmacy", zap.String("id", pharmacy.ID.String()))
	} else if err != nil {
		return err
	}

	users := []struct {
		email string
		name  string
		role  string
	}{
		{DemoAdminEmail, "Admin User", "admin"},
		{DemoManagerEmail, "Manager User", "manager"},
		{DemoPharmacistEmail, "Pharmacist User", "pharmacist"},
		{DemoBuyerEmail, "End User (Buyer)", "staff"},
		{DemoTestEmail, "Test User", "admin"},
	}
	seen := make(map[string]bool)
	for _, u := range users {
		if seen[u.email] {
			continue
		}
		seen[u.email] = true
		var user models.User
		err := db.WithContext(ctx).Where("email = ?", u.email).First(&user).Error
		if err == gorm.ErrRecordNotFound {
			user = models.User{
				PharmacyID: pharmacy.ID,
				Email:      u.email,
				Name:       u.name,
				Role:       u.role,
				IsActive:   true,
			}
			if err := user.SetPassword(DemoPassword); err != nil {
				return err
			}
			if err := db.WithContext(ctx).Create(&user).Error; err != nil {
				return err
			}
			log.Info("Created demo user", zap.String("email", u.email), zap.String("role", u.role))
		} else if err != nil {
			return err
		}
	}

	// Create a few demo notifications for admin user so the notification UI has sample data
	var adminUser models.User
	if err := db.WithContext(ctx).Where("email = ?", DemoAdminEmail).First(&adminUser).Error; err == nil {
		var count int64
		db.WithContext(ctx).Model(&models.Notification{}).Where("user_id = ?", adminUser.ID).Count(&count)
		if count == 0 {
			demos := []models.Notification{
				{PharmacyID: pharmacy.ID, UserID: adminUser.ID, Title: "Welcome to CarePlus", Message: "Your pharmacy dashboard is ready. You can manage products, orders, and payments from here.", Type: "info"},
				{PharmacyID: pharmacy.ID, UserID: adminUser.ID, Title: "New order received", Message: "Order #ORD-001 is pending confirmation.", Type: "order"},
				{PharmacyID: pharmacy.ID, UserID: adminUser.ID, Title: "Payment completed", Message: "Payment for order #ORD-001 has been received.", Type: "payment"},
			}
			for i := range demos {
				if err := db.WithContext(ctx).Create(&demos[i]).Error; err != nil {
					log.Warn("Demo notification create failed", zap.Error(err))
				}
			}
			log.Info("Created demo notifications for admin user")
		}
	}

	return nil
}
