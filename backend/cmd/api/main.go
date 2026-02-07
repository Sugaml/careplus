package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/careplus/pharmacy-backend/internal/adapters/auth"
	"github.com/careplus/pharmacy-backend/internal/adapters/http"
	"github.com/careplus/pharmacy-backend/internal/adapters/http/handlers"
	"github.com/careplus/pharmacy-backend/internal/adapters/http/ws"
	"github.com/careplus/pharmacy-backend/internal/adapters/persistence"
	"github.com/careplus/pharmacy-backend/internal/adapters/storage"
	"github.com/careplus/pharmacy-backend/internal/domain/services"
	"github.com/careplus/pharmacy-backend/internal/infrastructure/config"
	"github.com/careplus/pharmacy-backend/internal/infrastructure/database"
	"github.com/careplus/pharmacy-backend/internal/infrastructure/logger"
	"github.com/careplus/pharmacy-backend/internal/infrastructure/seed"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"go.uber.org/zap"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	environment := cfg.Server.Environment
	zapLogger, err := logger.NewZapLogger(environment)
	if err != nil {
		log.Fatalf("Failed to create logger: %v", err)
	}

	db, dbCleanup, err := database.NewPostgresConnection(cfg, zapLogger)
	if err != nil {
		zapLogger.Fatal("Failed to connect to database", zap.Error(err))
	}
	defer dbCleanup()

	// Ensure demo users exist for quick login (idempotent)
	ctx := context.Background()
	if err := seed.EnsureDemoUsers(ctx, db, zapLogger); err != nil {
		zapLogger.Warn("Demo users seed failed (quick login may not work)", zap.Error(err))
	}

	authProvider := auth.NewJWTAuthProvider(cfg)
	var authProviderInterface outbound.AuthProvider = authProvider

	pharmacyRepo := persistence.NewPharmacyRepository(db)
	configRepo := persistence.NewPharmacyConfigRepository(db)
	userRepo := persistence.NewUserRepository(db)
	productRepo := persistence.NewProductRepository(db)
	productImageRepo := persistence.NewProductImageRepository(db)
	categoryRepo := persistence.NewCategoryRepository(db)
	productUnitRepo := persistence.NewProductUnitRepository(db)
	membershipRepo := persistence.NewMembershipRepository(db)
	productReviewRepo := persistence.NewProductReviewRepository(db)
	reviewLikeRepo := persistence.NewReviewLikeRepository(db)
	reviewCommentRepo := persistence.NewReviewCommentRepository(db)
	orderRepo := persistence.NewOrderRepository(db)
	paymentRepo := persistence.NewPaymentRepository(db)
	paymentGatewayRepo := persistence.NewPaymentGatewayRepository(db)
	invoiceRepo := persistence.NewInvoiceRepository(db)
	inventoryBatchRepo := persistence.NewInventoryBatchRepository(db)
	promoCodeRepo := persistence.NewPromoCodeRepository(db)
	pointsTransactionRepo := persistence.NewPointsTransactionRepository(db)
	referralPointsConfigRepo := persistence.NewReferralPointsConfigRepository(db)
	customerRepo := persistence.NewCustomerRepository(db)
	customerMembershipRepo := persistence.NewCustomerMembershipRepository(db)
	activityLogRepo := persistence.NewActivityLogRepository(db)
	notificationRepo := persistence.NewNotificationRepository(db)
	promoRepo := persistence.NewPromoRepository(db)
	dutyRosterRepo := persistence.NewDutyRosterRepository(db)
	dailyLogRepo := persistence.NewDailyLogRepository(db)
	conversationRepo := persistence.NewConversationRepository(db)
	chatMessageRepo := persistence.NewChatMessageRepository(db)
	userAddressRepo := persistence.NewUserAddressRepository(db)
	announcementRepo := persistence.NewAnnouncementRepository(db)
	announcementAckRepo := persistence.NewAnnouncementAckRepository(db)

	authService := services.NewAuthService(userRepo, pharmacyRepo, authProviderInterface, zapLogger)
	userAddressService := services.NewUserAddressService(userAddressRepo, zapLogger)
	var userAddressServiceInterface inbound.UserAddressService = userAddressService
	userService := services.NewUserService(userRepo, pharmacyRepo, zapLogger)
	pharmacyService := services.NewPharmacyService(pharmacyRepo, zapLogger)
	configService := services.NewPharmacyConfigService(configRepo, zapLogger)
	productService := services.NewProductService(productRepo, productImageRepo, zapLogger)
	categoryService := services.NewCategoryService(categoryRepo, zapLogger)
	productUnitService := services.NewProductUnitService(productUnitRepo, zapLogger)
	membershipService := services.NewMembershipService(membershipRepo, zapLogger)
	reviewService := services.NewReviewService(productReviewRepo, reviewLikeRepo, reviewCommentRepo, productRepo, userRepo, zapLogger)
	inventoryService := services.NewInventoryService(inventoryBatchRepo, productRepo)
	promoCodeService := services.NewPromoCodeService(promoCodeRepo, orderRepo, zapLogger)
	referralPointsService := services.NewReferralPointsService(customerRepo, customerMembershipRepo, pointsTransactionRepo, referralPointsConfigRepo, orderRepo, zapLogger)
	var referralPointsServiceInterface inbound.ReferralPointsService = referralPointsService
	paymentService := services.NewPaymentService(paymentRepo, zapLogger)
	paymentGatewayService := services.NewPaymentGatewayService(paymentGatewayRepo, zapLogger)
	orderService := services.NewOrderService(orderRepo, productRepo, inventoryService, promoCodeRepo, promoCodeService, customerRepo, customerMembershipRepo, referralPointsServiceInterface, paymentGatewayRepo, paymentService, zapLogger)
	invoiceService := services.NewInvoiceService(invoiceRepo, orderRepo, paymentRepo, zapLogger)
	activityLogService := services.NewActivityLogService(activityLogRepo, zapLogger)
	notificationService := services.NewNotificationService(notificationRepo, zapLogger)
	promoService := services.NewPromoService(promoRepo, zapLogger)
	announcementService := services.NewAnnouncementService(announcementRepo, announcementAckRepo, zapLogger)
	dutyRosterService := services.NewDutyRosterService(dutyRosterRepo, userRepo, zapLogger)
	dailyLogService := services.NewDailyLogService(dailyLogRepo, zapLogger)
	chatService := services.NewChatService(conversationRepo, chatMessageRepo, configRepo, customerRepo, zapLogger)

	var authServiceInterface inbound.AuthService = authService
	var pharmacyServiceInterface inbound.PharmacyService = pharmacyService
	var configServiceInterface inbound.PharmacyConfigService = configService
	var productServiceInterface inbound.ProductService = productService
	var categoryServiceInterface inbound.CategoryService = categoryService
	var productUnitServiceInterface inbound.ProductUnitService = productUnitService
	var orderServiceInterface inbound.OrderService = orderService
	var paymentServiceInterface inbound.PaymentService = paymentService
	var inventoryServiceInterface inbound.InventoryService = inventoryService
	var invoiceServiceInterface inbound.InvoiceService = invoiceService
	var activityLogServiceInterface inbound.ActivityLogService = activityLogService
	var notificationServiceInterface inbound.NotificationService = notificationService

	var fileStorage outbound.FileStorage
	switch cfg.FS.Type {
	case "s3":
		s3Store, err := storage.NewS3Storage(cfg.FS)
		if err != nil {
			zapLogger.Fatal("Failed to create S3 storage", zap.Error(err))
		}
		fileStorage = s3Store
	default:
		fileStorage = storage.NewLocalStorage(cfg.FS)
	}

	authHandler := handlers.NewAuthHandler(authServiceInterface, zapLogger)
	addressHandler := handlers.NewAddressHandler(userAddressServiceInterface, zapLogger)
	pharmacyHandler := handlers.NewPharmacyHandler(pharmacyServiceInterface, zapLogger)
	configHandler := handlers.NewConfigHandler(configServiceInterface, zapLogger)
	usersHandler := handlers.NewUsersHandler(userService, zapLogger)
	dutyRosterHandler := handlers.NewDutyRosterHandler(dutyRosterService, zapLogger)
	dailyLogHandler := handlers.NewDailyLogHandler(dailyLogService, zapLogger)
	dashboardHandler := handlers.NewDashboardHandler(orderServiceInterface, productServiceInterface, userService, dutyRosterService, dailyLogService, zapLogger)
	productHandler := handlers.NewProductHandler(productServiceInterface, categoryServiceInterface, fileStorage, productReviewRepo, zapLogger)
	categoryHandler := handlers.NewCategoryHandler(categoryServiceInterface, zapLogger)
	productUnitHandler := handlers.NewProductUnitHandler(productUnitServiceInterface, zapLogger)
	var membershipServiceInterface inbound.MembershipService = membershipService
	membershipHandler := handlers.NewMembershipHandler(membershipServiceInterface, zapLogger)
	var reviewServiceInterface inbound.ReviewService = reviewService
	reviewHandler := handlers.NewReviewHandler(reviewServiceInterface, zapLogger)
	orderHandler := handlers.NewOrderHandler(orderServiceInterface, zapLogger)
	promoCodeHandler := handlers.NewPromoCodeHandler(promoCodeService, zapLogger)
	paymentHandler := handlers.NewPaymentHandler(paymentServiceInterface, zapLogger)
	paymentGatewayHandler := handlers.NewPaymentGatewayHandler(paymentGatewayService, zapLogger)
	inventoryHandler := handlers.NewInventoryHandler(inventoryServiceInterface)
	invoiceHandler := handlers.NewInvoiceHandler(invoiceServiceInterface, zapLogger)
	healthHandler := handlers.NewHealthHandler()
	uploadHandler := handlers.NewUploadHandler(fileStorage, zapLogger)
	activityHandler := handlers.NewActivityHandler(activityLogServiceInterface, zapLogger)
	notificationHandler := handlers.NewNotificationHandler(notificationServiceInterface, zapLogger)
	promoHandler := handlers.NewPromoHandler(promoService, zapLogger)
	var announcementServiceInterface inbound.AnnouncementService = announcementService
	announcementHandler := handlers.NewAnnouncementHandler(announcementServiceInterface, zapLogger)
	referralHandler := handlers.NewReferralHandler(referralPointsServiceInterface, zapLogger)
	chatHandler := handlers.NewChatHandler(chatService, authProviderInterface, zapLogger)
	chatHub := ws.NewHub(zapLogger)
	chatWSHandler := ws.HandleWS(authProviderInterface, userRepo, chatService, conversationRepo, chatHub, zapLogger)

	router := http.NewRouter(cfg, authHandler, addressHandler, pharmacyHandler, productHandler, categoryHandler, productUnitHandler, membershipHandler, reviewHandler, orderHandler, promoCodeHandler, paymentHandler, paymentGatewayHandler, inventoryHandler, invoiceHandler, configHandler, usersHandler, uploadHandler, activityHandler, notificationHandler, promoHandler, announcementHandler, referralHandler, healthHandler, dutyRosterHandler, dailyLogHandler, dashboardHandler, chatHandler, chatWSHandler, authProviderInterface, userRepo, activityLogServiceInterface, zapLogger)
	server := http.NewServer(router, cfg, zapLogger)

	go func() {
		if err := server.Start(); err != nil {
			zapLogger.Fatal("Server failed", zap.Error(err))
		}
	}()

	log.Printf("CarePlus Pharmacy API running on port %s", cfg.Server.Port)
	log.Println("Press Ctrl+C to stop")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		zapLogger.Fatal("Server forced to shutdown", zap.Error(err))
	}
	zapLogger.Info("Server stopped gracefully")
}
