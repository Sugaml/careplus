package database

import (
	"fmt"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/infrastructure/config"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func NewPostgresConnection(cfg *config.Config, log *zap.Logger) (*gorm.DB, func(), error) {
	dsn := cfg.GetDSN()
	gormConfig := &gorm.Config{}
	if cfg.IsDevelopment() {
		gormConfig.Logger = logger.Default.LogMode(logger.Info)
	} else {
		gormConfig.Logger = logger.Default.LogMode(logger.Warn)
	}

	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get underlying database: %w", err)
	}
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if err := sqlDB.Ping(); err != nil {
		return nil, nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Info("Connected to PostgreSQL", zap.String("database", cfg.Database.Name))

	if err := db.AutoMigrate(
		&models.Pharmacy{},
		&models.PharmacyConfig{},
		&models.User{},
		&models.Product{},
		&models.ProductImage{},
		&models.Category{},
		&models.ProductUnit{},
		&models.Membership{},
		&models.ProductReview{},
		&models.ReviewLike{},
		&models.ReviewComment{},
		&models.PromoCode{},
		&models.Customer{},
		&models.CustomerMembership{},
		&models.ReferralPointsConfig{},
		&models.PointsTransaction{},
		&models.Order{},
		&models.OrderItem{},
		&models.Payment{},
		&models.Invoice{},
		&models.InventoryBatch{},
		&models.ActivityLog{},
		&models.Notification{},
		&models.Promo{},
		&models.DutyRoster{},
		&models.DailyLog{},
	); err != nil {
		return nil, nil, fmt.Errorf("auto migrate failed: %w", err)
	}

	cleanup := func() {
		if c, _ := db.DB(); c != nil {
			_ = c.Close()
		}
	}
	return db, cleanup, nil
}
