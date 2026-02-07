package outbound

//go:generate mockgen -source=repositories.go -destination=../../mocks/outbound/repositories_mock_gen.go -package=mocks
// Run from repo root: go generate ./internal/ports/outbound/...

import (
	"context"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/google/uuid"
)

type PharmacyRepository interface {
	Create(ctx context.Context, p *models.Pharmacy) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Pharmacy, error)
	GetByHostnameSlug(ctx context.Context, hostnameSlug string) (*models.Pharmacy, error)
	Update(ctx context.Context, p *models.Pharmacy) error
	List(ctx context.Context) ([]*models.Pharmacy, error)
}

type UserRepository interface {
	Create(ctx context.Context, u *models.User) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.User, error)
	GetByEmail(ctx context.Context, email string) (*models.User, error)
	GetByPharmacyID(ctx context.Context, pharmacyID uuid.UUID) ([]*models.User, error)
	Update(ctx context.Context, u *models.User) error
}

type DutyRosterRepository interface {
	Create(ctx context.Context, d *models.DutyRoster) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.DutyRoster, error)
	ListByPharmacyAndDateRange(ctx context.Context, pharmacyID uuid.UUID, from, to time.Time) ([]*models.DutyRoster, error)
	Update(ctx context.Context, d *models.DutyRoster) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type DailyLogRepository interface {
	Create(ctx context.Context, d *models.DailyLog) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.DailyLog, error)
	ListByPharmacyAndDate(ctx context.Context, pharmacyID uuid.UUID, date time.Time) ([]*models.DailyLog, error)
	ListByPharmacyAndDateRange(ctx context.Context, pharmacyID uuid.UUID, from, to time.Time) ([]*models.DailyLog, error)
	Update(ctx context.Context, d *models.DailyLog) error
	Delete(ctx context.Context, id uuid.UUID) error
}

// CatalogFilters are optional filters for the product catalog (hashtag, brand, label key-value).
type CatalogFilters struct {
	Hashtag    *string
	Brand      *string
	LabelKey   *string
	LabelValue *string
}

// CatalogSort defines sort options for product catalog listing.
type CatalogSort string

const (
	CatalogSortName     CatalogSort = "name"
	CatalogSortPriceAsc CatalogSort = "price_asc"
	CatalogSortPriceDesc CatalogSort = "price_desc"
	CatalogSortNewest   CatalogSort = "newest"
)

type ProductRepository interface {
	Create(ctx context.Context, p *models.Product) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Product, error)
	GetBySKU(ctx context.Context, pharmacyID uuid.UUID, sku string) (*models.Product, error)
	GetByBarcode(ctx context.Context, pharmacyID uuid.UUID, barcode string) (*models.Product, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool) ([]*models.Product, error)
	// ListByPharmacyPaginated returns a page of products and total count. limit/offset 0 means no pagination (all).
	ListByPharmacyPaginated(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool, limit, offset int) ([]*models.Product, int64, error)
	// ListByPharmacyCatalog returns a page of products with optional search (q), sort, and catalog filters (hashtag, brand, label).
	ListByPharmacyCatalog(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool, searchQ string, sort CatalogSort, limit, offset int, filters *CatalogFilters) ([]*models.Product, int64, error)
	Update(ctx context.Context, p *models.Product) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type ProductImageRepository interface {
	Create(ctx context.Context, img *models.ProductImage) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.ProductImage, error)
	ListByProductID(ctx context.Context, productID uuid.UUID) ([]*models.ProductImage, error)
	Update(ctx context.Context, img *models.ProductImage) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type OrderRepository interface {
	Create(ctx context.Context, o *models.Order) error
	CreateItem(ctx context.Context, item *models.OrderItem) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Order, error)
	GetByOrderNumber(ctx context.Context, pharmacyID uuid.UUID, orderNumber string) (*models.Order, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, status *string) ([]*models.Order, error)
	// ListByPharmacyAndCreatedBy returns orders for the pharmacy placed by the given user (for end-user "my orders").
	ListByPharmacyAndCreatedBy(ctx context.Context, pharmacyID uuid.UUID, createdBy uuid.UUID, status *string) ([]*models.Order, error)
	Update(ctx context.Context, o *models.Order) error
	GetItemsByOrderID(ctx context.Context, orderID uuid.UUID) ([]*models.OrderItem, error)
	CountByCustomerIDAndStatus(ctx context.Context, customerID uuid.UUID, status string) (int64, error)
	// CountByCreatedByAndPharmacy returns the number of orders placed by this user at this pharmacy (for first-order-only promo).
	CountByCreatedByAndPharmacy(ctx context.Context, createdBy, pharmacyID uuid.UUID) (int64, error)
}

type PaymentRepository interface {
	Create(ctx context.Context, p *models.Payment) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Payment, error)
	ListByOrderID(ctx context.Context, orderID uuid.UUID) ([]*models.Payment, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Payment, error)
	Update(ctx context.Context, p *models.Payment) error
}

type PaymentGatewayRepository interface {
	Create(ctx context.Context, pg *models.PaymentGateway) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.PaymentGateway, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, activeOnly bool) ([]*models.PaymentGateway, error)
	Update(ctx context.Context, pg *models.PaymentGateway) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type PharmacyConfigRepository interface {
	GetByPharmacyID(ctx context.Context, pharmacyID uuid.UUID) (*models.PharmacyConfig, error)
	Create(ctx context.Context, c *models.PharmacyConfig) error
	Update(ctx context.Context, c *models.PharmacyConfig) error
}

type CategoryRepository interface {
	Create(ctx context.Context, c *models.Category) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Category, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Category, error)
	// ListByParentID returns top-level categories when parentID is nil, or children of parent when set.
	ListByParentID(ctx context.Context, pharmacyID uuid.UUID, parentID *uuid.UUID) ([]*models.Category, error)
	Update(ctx context.Context, c *models.Category) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type ProductUnitRepository interface {
	Create(ctx context.Context, u *models.ProductUnit) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.ProductUnit, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.ProductUnit, error)
	Update(ctx context.Context, u *models.ProductUnit) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type ActivityLogRepository interface {
	Create(ctx context.Context, a *models.ActivityLog) error
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, limit, offset int) ([]*models.ActivityLog, error)
}

type InvoiceRepository interface {
	Create(ctx context.Context, inv *models.Invoice) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Invoice, error)
	GetByOrderID(ctx context.Context, orderID uuid.UUID) (*models.Invoice, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Invoice, error)
	Update(ctx context.Context, inv *models.Invoice) error
}

type NotificationRepository interface {
	Create(ctx context.Context, n *models.Notification) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Notification, error)
	ListByUser(ctx context.Context, userID uuid.UUID, unreadOnly bool, limit, offset int) ([]*models.Notification, error)
	CountUnreadByUser(ctx context.Context, userID uuid.UUID) (int64, error)
	MarkRead(ctx context.Context, id, userID uuid.UUID) error
	MarkAllRead(ctx context.Context, userID uuid.UUID) error
}

type InventoryBatchRepository interface {
	Create(ctx context.Context, b *models.InventoryBatch) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.InventoryBatch, error)
	ListByProductID(ctx context.Context, productID uuid.UUID) ([]*models.InventoryBatch, error)
	ListByPharmacyID(ctx context.Context, pharmacyID uuid.UUID) ([]*models.InventoryBatch, error)
	ListExpiringByPharmacy(ctx context.Context, pharmacyID uuid.UUID, beforeOrOn time.Time) ([]*models.InventoryBatch, error)
	Update(ctx context.Context, b *models.InventoryBatch) error
	Delete(ctx context.Context, id uuid.UUID) error
}

// RatingStats holds aggregate rating for a product.
type RatingStats struct {
	Avg   float64
	Count int
}

type ProductReviewRepository interface {
	Create(ctx context.Context, r *models.ProductReview) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.ProductReview, error)
	ListByProductID(ctx context.Context, productID uuid.UUID, limit, offset int) ([]*models.ProductReview, error)
	Update(ctx context.Context, r *models.ProductReview) error
	Delete(ctx context.Context, id uuid.UUID) error
	ExistsByProductAndUser(ctx context.Context, productID, userID uuid.UUID) (bool, error)
	// GetRatingStatsByProductIDs returns avg rating and review count per product (for catalog display).
	GetRatingStatsByProductIDs(ctx context.Context, productIDs []uuid.UUID) (map[uuid.UUID]RatingStats, error)
}

type ReviewLikeRepository interface {
	Create(ctx context.Context, l *models.ReviewLike) error
	DeleteByReviewAndUser(ctx context.Context, reviewID, userID uuid.UUID) error
	CountByReviewID(ctx context.Context, reviewID uuid.UUID) (int64, error)
	Exists(ctx context.Context, reviewID, userID uuid.UUID) (bool, error)
}

type ReviewCommentRepository interface {
	Create(ctx context.Context, c *models.ReviewComment) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.ReviewComment, error)
	ListByReviewID(ctx context.Context, reviewID uuid.UUID, limit, offset int) ([]*models.ReviewComment, error)
	CountByReviewID(ctx context.Context, reviewID uuid.UUID) (int64, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type MembershipRepository interface {
	Create(ctx context.Context, m *models.Membership) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Membership, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Membership, error)
	Update(ctx context.Context, m *models.Membership) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type CustomerMembershipRepository interface {
	Create(ctx context.Context, cm *models.CustomerMembership) error
	GetByCustomerID(ctx context.Context, customerID uuid.UUID) (*models.CustomerMembership, error)
	Update(ctx context.Context, cm *models.CustomerMembership) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type PromoRepository interface {
	Create(ctx context.Context, p *models.Promo) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Promo, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, types []string, activeOnly bool) ([]*models.Promo, error)
	Update(ctx context.Context, p *models.Promo) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type PromoCodeRepository interface {
	Create(ctx context.Context, p *models.PromoCode) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.PromoCode, error)
	GetByPharmacyAndCode(ctx context.Context, pharmacyID uuid.UUID, code string) (*models.PromoCode, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.PromoCode, error)
	Update(ctx context.Context, p *models.PromoCode) error
	IncrementUsedCount(ctx context.Context, id uuid.UUID) error
}

type CustomerRepository interface {
	Create(ctx context.Context, c *models.Customer) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Customer, error)
	GetByPharmacyAndPhone(ctx context.Context, pharmacyID uuid.UUID, phone string) (*models.Customer, error)
	GetByPharmacyAndReferralCode(ctx context.Context, pharmacyID uuid.UUID, code string) (*models.Customer, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, limit, offset int) ([]*models.Customer, int64, error)
	Update(ctx context.Context, c *models.Customer) error
}

type PointsTransactionRepository interface {
	Create(ctx context.Context, p *models.PointsTransaction) error
	ListByCustomer(ctx context.Context, customerID uuid.UUID, limit, offset int) ([]*models.PointsTransaction, error)
}

type ReferralPointsConfigRepository interface {
	Create(ctx context.Context, c *models.ReferralPointsConfig) error
	GetByPharmacyID(ctx context.Context, pharmacyID uuid.UUID) (*models.ReferralPointsConfig, error)
	Update(ctx context.Context, c *models.ReferralPointsConfig) error
}

type ConversationRepository interface {
	Create(ctx context.Context, c *models.Conversation) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Conversation, error)
	GetByPharmacyAndCustomer(ctx context.Context, pharmacyID, customerID uuid.UUID) (*models.Conversation, error)
	GetByPharmacyAndUser(ctx context.Context, pharmacyID, userID uuid.UUID) (*models.Conversation, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, userID *uuid.UUID, limit, offset int) ([]*models.Conversation, int64, error)
	Update(ctx context.Context, c *models.Conversation) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type ChatMessageRepository interface {
	Create(ctx context.Context, m *models.ChatMessage) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.ChatMessage, error)
	ListByConversationID(ctx context.Context, conversationID uuid.UUID, limit, offset int) ([]*models.ChatMessage, int64, error)
	Update(ctx context.Context, m *models.ChatMessage) error
	Delete(ctx context.Context, id uuid.UUID) error
	DeleteByConversationID(ctx context.Context, conversationID uuid.UUID) error
}

type UserAddressRepository interface {
	Create(ctx context.Context, a *models.UserAddress) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.UserAddress, error)
	ListByUserID(ctx context.Context, userID uuid.UUID) ([]*models.UserAddress, error)
	Update(ctx context.Context, a *models.UserAddress) error
	Delete(ctx context.Context, id uuid.UUID) error
	ClearDefaultByUserID(ctx context.Context, userID uuid.UUID) error
}

type AnnouncementRepository interface {
	Create(ctx context.Context, a *models.Announcement) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Announcement, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, activeOnly bool) ([]*models.Announcement, error)
	Update(ctx context.Context, a *models.Announcement) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type AnnouncementAckRepository interface {
	Create(ctx context.Context, a *models.AnnouncementAck) error
	HasAcked(ctx context.Context, userID, announcementID uuid.UUID) (bool, error)
	HasSkippedAllSince(ctx context.Context, userID uuid.UUID, since time.Time) (bool, error)
}
