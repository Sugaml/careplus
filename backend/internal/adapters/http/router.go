package http

import (
	"github.com/careplus/pharmacy-backend/internal/adapters/http/handlers"
	"github.com/careplus/pharmacy-backend/internal/adapters/http/middleware"
	"github.com/careplus/pharmacy-backend/internal/infrastructure/config"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func NewRouter(
	cfg *config.Config,
	authHandler *handlers.AuthHandler,
	pharmacyHandler *handlers.PharmacyHandler,
	productHandler *handlers.ProductHandler,
	categoryHandler *handlers.CategoryHandler,
	productUnitHandler *handlers.ProductUnitHandler,
	membershipHandler *handlers.MembershipHandler,
	reviewHandler *handlers.ReviewHandler,
	orderHandler *handlers.OrderHandler,
	promoCodeHandler *handlers.PromoCodeHandler,
	paymentHandler *handlers.PaymentHandler,
	inventoryHandler *handlers.InventoryHandler,
	invoiceHandler *handlers.InvoiceHandler,
	configHandler *handlers.ConfigHandler,
	usersHandler *handlers.UsersHandler,
	uploadHandler *handlers.UploadHandler,
	activityHandler *handlers.ActivityHandler,
	notificationHandler *handlers.NotificationHandler,
	promoHandler *handlers.PromoHandler,
	referralHandler *handlers.ReferralHandler,
	healthHandler *handlers.HealthHandler,
	dutyRosterHandler *handlers.DutyRosterHandler,
	dailyLogHandler *handlers.DailyLogHandler,
	dashboardHandler *handlers.DashboardHandler,
	authProvider outbound.AuthProvider,
	userRepo outbound.UserRepository,
	activityLogService inbound.ActivityLogService,
	logger *zap.Logger,
) *gin.Engine {
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.New()
	router.Use(middleware.Recovery(logger))
	router.Use(middleware.Logger(logger))
	router.Use(middleware.CORS(cfg))

	// Serve local uploads when FS_TYPE=local
	if cfg.FS.Type == "local" && cfg.FS.LocalBaseDir != "" && cfg.FS.LocalBaseURL != "" {
		router.Static(cfg.FS.LocalBaseURL, cfg.FS.LocalBaseDir)
	}

	router.GET("/health", healthHandler.Check)
	router.GET("/health/ready", healthHandler.Readiness)
	router.GET("/health/live", healthHandler.Liveness)

	v1 := router.Group("/api/v1")
	{
		// Public routes (no auth): browse products and pharmacies
		public := v1.Group("/public")
		{
			public.GET("/pharmacies", pharmacyHandler.List)
			public.GET("/pharmacies/:pharmacyId/config", configHandler.GetByPharmacyID)
			public.GET("/pharmacies/:pharmacyId/products", productHandler.ListByPharmacyID)
			public.GET("/pharmacies/:pharmacyId/categories", categoryHandler.ListByPharmacyID)
			public.GET("/pharmacies/:pharmacyId", pharmacyHandler.GetByID)
			public.GET("/pharmacies/:pharmacyId/promos", promoHandler.ListPublic)
			public.GET("/pharmacies/:pharmacyId/referral/validate", referralHandler.ValidateReferralCode)
			public.GET("/products/:id", productHandler.GetByID)
			public.GET("/products/:id/reviews", reviewHandler.ListByProductID)
		}

		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
		}
		authProtected := v1.Group("/auth")
		authProtected.Use(middleware.Auth(authProvider, userRepo, logger))
		{
			authProtected.GET("/me", authHandler.GetCurrentUser)
			authProtected.PATCH("/me", authHandler.UpdateProfile)
			authProtected.PATCH("/me/password", authHandler.ChangePassword)
		}

		api := v1.Group("")
		api.Use(middleware.Auth(authProvider, userRepo, logger))
		api.Use(middleware.ActivityLog(activityLogService, logger))
		{
			api.POST("/upload", uploadHandler.Upload)
			api.GET("/dashboard/stats", dashboardHandler.GetStats)
			api.GET("/activity", activityHandler.List)
			api.GET("/notifications", notificationHandler.List)
			api.GET("/notifications/unread/count", notificationHandler.CountUnread)
			api.POST("/notifications/read-all", notificationHandler.MarkAllRead)
			api.POST("/notifications/:id/read", notificationHandler.MarkRead)
			api.GET("/orders/:orderId/payments", paymentHandler.ListByOrder)
			pharmacies := api.Group("/pharmacies")
			{
				pharmacies.GET("", pharmacyHandler.List)
				pharmacies.GET("/:id", pharmacyHandler.GetByID)
			}
			// Admin-only: pharmacy create/update, config, notifications create, promos, referral config
			admin := api.Group("").Use(middleware.RequireAdmin())
			{
				admin.POST("/pharmacies", pharmacyHandler.Create)
				admin.PUT("/pharmacies/:id", pharmacyHandler.Update)
				admin.GET("/config", configHandler.GetOrCreate)
				admin.PUT("/config", configHandler.Upsert)
				admin.POST("/notifications", notificationHandler.Create)
				admin.GET("/promos", promoHandler.List)
				admin.POST("/promos", promoHandler.Create)
				admin.GET("/promos/:id", promoHandler.GetByID)
				admin.PUT("/promos/:id", promoHandler.Update)
				admin.DELETE("/promos/:id", promoHandler.Delete)
				admin.PUT("/referral/config", referralHandler.UpsertConfig)
			}
			// Admin or Manager: users (list/create/get/update/deactivate), duty roster, daily logs
			adminOrManager := api.Group("").Use(middleware.RequireAdminOrManager())
			{
				adminOrManager.POST("/products/:id/batches", inventoryHandler.AddBatch)
				adminOrManager.PATCH("/inventory/batches/:batchId", inventoryHandler.UpdateBatch)
				adminOrManager.DELETE("/inventory/batches/:batchId", inventoryHandler.DeleteBatch)
				adminOrManager.GET("/users", usersHandler.List)
				adminOrManager.POST("/users", usersHandler.Create)
				adminOrManager.GET("/users/:id", usersHandler.GetByID)
				adminOrManager.PUT("/users/:id", usersHandler.Update)
				adminOrManager.PATCH("/users/:id/deactivate", usersHandler.Deactivate)
				adminOrManager.GET("/duty-roster", dutyRosterHandler.List)
				adminOrManager.POST("/duty-roster", dutyRosterHandler.Create)
				adminOrManager.GET("/duty-roster/:id", dutyRosterHandler.GetByID)
				adminOrManager.PUT("/duty-roster/:id", dutyRosterHandler.Update)
				adminOrManager.DELETE("/duty-roster/:id", dutyRosterHandler.Delete)
				adminOrManager.GET("/daily-logs", dailyLogHandler.List)
				adminOrManager.POST("/daily-logs", dailyLogHandler.Create)
				adminOrManager.GET("/daily-logs/:id", dailyLogHandler.GetByID)
				adminOrManager.PUT("/daily-logs/:id", dailyLogHandler.Update)
				adminOrManager.DELETE("/daily-logs/:id", dailyLogHandler.Delete)
			}
			api.GET("/referral/config", referralHandler.GetConfig)
			customers := api.Group("/customers")
			{
				customers.GET("", referralHandler.ListCustomers)
				customers.GET("/by-phone", referralHandler.GetCustomerByPhone)
				customers.GET("/:customerId/points", referralHandler.ListPointsTransactions)
			}
			api.GET("/referral/redeem-preview", referralHandler.ComputeRedeemPreview)
			products := api.Group("/products")
			{
				products.POST("", productHandler.Create)
				products.GET("", productHandler.List)
				products.GET("/by-barcode/:barcode", productHandler.GetByBarcode)
				products.GET("/:id", productHandler.GetByID)
				products.PUT("/:id", productHandler.Update)
				products.PATCH("/:id/stock", productHandler.UpdateStock)
				products.DELETE("/:id", productHandler.Delete)
				products.POST("/:id/images", productHandler.AddImage)
				products.PATCH("/:id/images/reorder", productHandler.ReorderImages)
				products.PATCH("/:id/images/:imageId/primary", productHandler.SetPrimaryImage)
				products.DELETE("/:id/images/:imageId", productHandler.DeleteImage)
				products.GET("/:id/batches", inventoryHandler.ListBatchesByProduct)
				products.GET("/:id/reviews", reviewHandler.ListByProductID)
				products.POST("/:id/reviews", reviewHandler.Create)
			}
			reviews := api.Group("/reviews")
			{
				reviews.GET("/:id", reviewHandler.GetByID)
				reviews.PUT("/:id", reviewHandler.Update)
				reviews.DELETE("/:id", reviewHandler.Delete)
				reviews.POST("/:id/like", reviewHandler.Like)
				reviews.DELETE("/:id/like", reviewHandler.Unlike)
				reviews.GET("/:id/comments", reviewHandler.ListComments)
				reviews.POST("/:id/comments", reviewHandler.CreateComment)
			}
			api.DELETE("/comments/:id", reviewHandler.DeleteComment)
			inventory := api.Group("/inventory")
			{
				inventory.GET("/batches", inventoryHandler.ListBatchesByPharmacy)
				inventory.GET("/expiring", inventoryHandler.ListExpiringSoon)
				inventory.GET("/batches/:batchId", inventoryHandler.GetBatch)
			}
			categories := api.Group("/categories")
			{
				categories.POST("", categoryHandler.Create)
				categories.GET("", categoryHandler.List)
				categories.GET("/:id", categoryHandler.GetByID)
				categories.PUT("/:id", categoryHandler.Update)
				categories.DELETE("/:id", categoryHandler.Delete)
			}
			productUnits := api.Group("/product-units")
			{
				productUnits.POST("", productUnitHandler.Create)
				productUnits.GET("", productUnitHandler.List)
				productUnits.GET("/:id", productUnitHandler.GetByID)
				productUnits.PUT("/:id", productUnitHandler.Update)
				productUnits.DELETE("/:id", productUnitHandler.Delete)
			}
			memberships := api.Group("/memberships")
			{
				memberships.POST("", membershipHandler.Create)
				memberships.GET("", membershipHandler.List)
				memberships.GET("/:id", membershipHandler.GetByID)
				memberships.PUT("/:id", membershipHandler.Update)
				memberships.DELETE("/:id", membershipHandler.Delete)
			}
			orders := api.Group("/orders")
			{
				orders.POST("", orderHandler.Create)
				orders.GET("", orderHandler.List)
				orders.GET("/:orderId", orderHandler.GetByID)
				orders.POST("/:orderId/accept", orderHandler.Accept)
				orders.PATCH("/:orderId/status", orderHandler.UpdateStatus)
				orders.POST("/:orderId/invoices", invoiceHandler.CreateFromOrder)
			}
			promoCodes := api.Group("/promo-codes")
			{
				promoCodes.POST("/validate", promoCodeHandler.Validate)
				promoCodes.GET("/validate", promoCodeHandler.ValidateQuery)
				promoCodes.POST("", promoCodeHandler.Create)
				promoCodes.GET("", promoCodeHandler.List)
				promoCodes.GET("/:id", promoCodeHandler.GetByID)
				promoCodes.PUT("/:id", promoCodeHandler.Update)
			}
			invoices := api.Group("/invoices")
			{
				invoices.GET("", invoiceHandler.List)
				invoices.GET("/:id", invoiceHandler.GetByID)
				invoices.POST("/:id/issue", invoiceHandler.Issue)
			}
			payments := api.Group("/payments")
			{
				payments.POST("", paymentHandler.Create)
				payments.GET("", paymentHandler.ListByPharmacy)
				payments.GET("/:id", paymentHandler.GetByID)
				payments.POST("/:id/complete", paymentHandler.Complete)
			}
		}
	}
	return router
}
