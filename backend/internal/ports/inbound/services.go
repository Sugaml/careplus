package inbound

import (
	"context"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/google/uuid"
)

type AuthService interface {
	Register(ctx context.Context, pharmacyID uuid.UUID, email, password, name, role string) (*models.User, error)
	Login(ctx context.Context, email, password string) (accessToken, refreshToken string, user *models.User, err error)
	RefreshToken(ctx context.Context, refreshToken string) (accessToken string, err error)
	GetCurrentUser(ctx context.Context, userID uuid.UUID) (*models.User, error)
	UpdateProfile(ctx context.Context, userID uuid.UUID, name string) (*models.User, error)
	ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string) error
}

// UserAddressService manages addresses for the logged-in user (profile settings).
type UserAddressService interface {
	ListByUser(ctx context.Context, userID uuid.UUID) ([]*models.UserAddress, error)
	Create(ctx context.Context, userID uuid.UUID, label, line1, line2, city, state, postalCode, country, phone string, setAsDefault bool) (*models.UserAddress, error)
	Update(ctx context.Context, userID uuid.UUID, id uuid.UUID, label, line1, line2, city, state, postalCode, country, phone *string, setAsDefault *bool) (*models.UserAddress, error)
	Delete(ctx context.Context, userID uuid.UUID, id uuid.UUID) error
	SetDefault(ctx context.Context, userID uuid.UUID, id uuid.UUID) (*models.UserAddress, error)
}

// UserService is for admin/manager to manage staff (create/update/deactivate). List/Get enforce role scope.
type UserService interface {
	// List returns users for the pharmacy; if actorRole is manager, only pharmacists are returned.
	List(ctx context.Context, pharmacyID uuid.UUID, actorRole string) ([]*models.User, error)
	// Create creates a user; admin can set role manager|pharmacist|staff, manager can only pharmacist.
	Create(ctx context.Context, pharmacyID uuid.UUID, actorRole string, email, password, name, role string) (*models.User, error)
	GetByID(ctx context.Context, pharmacyID uuid.UUID, actorRole string, userID uuid.UUID) (*models.User, error)
	Update(ctx context.Context, pharmacyID uuid.UUID, actorRole string, userID uuid.UUID, name string, role *string, isActive *bool) (*models.User, error)
	// Deactivate sets user IsActive to false (soft disable).
	Deactivate(ctx context.Context, pharmacyID uuid.UUID, actorRole string, userID uuid.UUID) (*models.User, error)
}

type DutyRosterService interface {
	Create(ctx context.Context, pharmacyID uuid.UUID, userID uuid.UUID, date time.Time, shiftType models.ShiftType, notes string) (*models.DutyRoster, error)
	GetByID(ctx context.Context, pharmacyID uuid.UUID, id uuid.UUID) (*models.DutyRoster, error)
	ListByDateRange(ctx context.Context, pharmacyID uuid.UUID, from, to time.Time) ([]*models.DutyRoster, error)
	Update(ctx context.Context, pharmacyID uuid.UUID, id uuid.UUID, userID *uuid.UUID, date *time.Time, shiftType *models.ShiftType, notes *string) (*models.DutyRoster, error)
	Delete(ctx context.Context, pharmacyID uuid.UUID, id uuid.UUID) error
}

type DailyLogService interface {
	Create(ctx context.Context, pharmacyID uuid.UUID, createdBy uuid.UUID, date time.Time, title, description string) (*models.DailyLog, error)
	GetByID(ctx context.Context, pharmacyID uuid.UUID, id uuid.UUID) (*models.DailyLog, error)
	ListByDate(ctx context.Context, pharmacyID uuid.UUID, date time.Time) ([]*models.DailyLog, error)
	ListByDateRange(ctx context.Context, pharmacyID uuid.UUID, from, to time.Time) ([]*models.DailyLog, error)
	Update(ctx context.Context, pharmacyID uuid.UUID, id uuid.UUID, title, description *string, status *models.DailyLogStatus) (*models.DailyLog, error)
	Delete(ctx context.Context, pharmacyID uuid.UUID, id uuid.UUID) error
}

type PharmacyService interface {
	Create(ctx context.Context, p *models.Pharmacy) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Pharmacy, error)
	Update(ctx context.Context, p *models.Pharmacy) error
	List(ctx context.Context) ([]*models.Pharmacy, error)
}

// CatalogSort is the sort option for product catalog (re-export from outbound for API use).
type CatalogSort string

const (
	CatalogSortName      CatalogSort = "name"
	CatalogSortPriceAsc  CatalogSort = "price_asc"
	CatalogSortPriceDesc CatalogSort = "price_desc"
	CatalogSortNewest    CatalogSort = "newest"
)

// CatalogFilters are optional filters for the product catalog (hashtag, brand, label key-value).
type CatalogFilters struct {
	Hashtag    *string
	Brand      *string
	LabelKey   *string
	LabelValue *string
}

type ProductService interface {
	Create(ctx context.Context, p *models.Product) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Product, error)
	GetByBarcode(ctx context.Context, pharmacyID uuid.UUID, barcode string) (*models.Product, error)
	List(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool) ([]*models.Product, error)
	// ListPaginated returns a page of products and total count. limit/offset 0 means no pagination (all).
	ListPaginated(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool, limit, offset int) ([]*models.Product, int64, error)
	// ListCatalog returns a page of products with search, sort, and optional filters (hashtag, brand, label) for the public catalog (active only).
	ListCatalog(ctx context.Context, pharmacyID uuid.UUID, category *string, inStockOnly *bool, searchQ string, sort CatalogSort, limit, offset int, filters *CatalogFilters) ([]*models.Product, int64, error)
	Update(ctx context.Context, p *models.Product) error
	UpdateStock(ctx context.Context, productID uuid.UUID, quantity int) error
	Delete(ctx context.Context, id uuid.UUID) error
	AddImage(ctx context.Context, productID uuid.UUID, url string, isPrimary bool) (*models.ProductImage, error)
	SetPrimaryImage(ctx context.Context, productID, imageID uuid.UUID) error
	ReorderImages(ctx context.Context, productID uuid.UUID, imageIDs []uuid.UUID) error
	DeleteImage(ctx context.Context, productID, imageID uuid.UUID) error
}

type OrderService interface {
	Create(ctx context.Context, pharmacyID, createdBy uuid.UUID, customerName, customerPhone, customerEmail string, items []OrderItemInput, notes string, discountAmount *float64, promoCode *string, referralCode *string, pointsToRedeem *int, paymentGatewayID *uuid.UUID) (*models.Order, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.Order, error)
	List(ctx context.Context, pharmacyID uuid.UUID, createdBy *uuid.UUID, status *string) ([]*models.Order, error)
	UpdateStatus(ctx context.Context, orderID uuid.UUID, status models.OrderStatus) (*models.Order, error)
	Accept(ctx context.Context, orderID uuid.UUID) (*models.Order, error)
}

type OrderItemInput struct {
	ProductID uuid.UUID `json:"product_id" binding:"required"`
	Quantity  int       `json:"quantity" binding:"required,min=1"`
	UnitPrice float64   `json:"unit_price" binding:"required,min=0"`
}

type PaymentService interface {
	Create(ctx context.Context, p *models.Payment) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Payment, error)
	ListByOrder(ctx context.Context, orderID uuid.UUID) ([]*models.Payment, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Payment, error)
	Complete(ctx context.Context, paymentID uuid.UUID) error
}

type PaymentGatewayService interface {
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, activeOnly bool) ([]*models.PaymentGateway, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.PaymentGateway, error)
	Create(ctx context.Context, pharmacyID uuid.UUID, pg *models.PaymentGateway) (*models.PaymentGateway, error)
	Update(ctx context.Context, pharmacyID uuid.UUID, pg *models.PaymentGateway) (*models.PaymentGateway, error)
	Delete(ctx context.Context, pharmacyID, id uuid.UUID) error
}

type PharmacyConfigService interface {
	GetByPharmacyID(ctx context.Context, pharmacyID uuid.UUID) (*models.PharmacyConfig, error)
	GetOrCreateByPharmacyID(ctx context.Context, pharmacyID uuid.UUID) (*models.PharmacyConfig, error)
	Upsert(ctx context.Context, pharmacyID uuid.UUID, c *models.PharmacyConfig) (*models.PharmacyConfig, error)
}

type CategoryService interface {
	Create(ctx context.Context, c *models.Category) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Category, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Category, error)
	ListByParentID(ctx context.Context, pharmacyID uuid.UUID, parentID *uuid.UUID) ([]*models.Category, error)
	Update(ctx context.Context, c *models.Category) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type ProductUnitService interface {
	Create(ctx context.Context, u *models.ProductUnit) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.ProductUnit, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.ProductUnit, error)
	Update(ctx context.Context, u *models.ProductUnit) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type ActivityLogService interface {
	Create(ctx context.Context, pharmacyID, userID uuid.UUID, action, entityType, entityID, details, ipAddress string) error
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, limit, offset int) ([]*models.ActivityLog, error)
}

// PromoCodeValidateResult is returned when validating a promo code for billing.
type PromoCodeValidateResult struct {
	Code           string  `json:"code"`
	DiscountAmount float64 `json:"discount_amount"`
	PromoCodeID    uuid.UUID `json:"promo_code_id"`
}

type PromoCodeService interface {
	Validate(ctx context.Context, pharmacyID uuid.UUID, code string, subTotal float64, userID *uuid.UUID) (*PromoCodeValidateResult, error)
	Create(ctx context.Context, pharmacyID uuid.UUID, p *models.PromoCode) (*models.PromoCode, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.PromoCode, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.PromoCode, error)
	Update(ctx context.Context, pharmacyID uuid.UUID, p *models.PromoCode) (*models.PromoCode, error)
}

type InvoiceService interface {
	CreateFromOrder(ctx context.Context, pharmacyID, orderID, createdBy uuid.UUID) (*models.Invoice, error)
	GetByID(ctx context.Context, id uuid.UUID) (*InvoiceView, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Invoice, error)
	Issue(ctx context.Context, invoiceID uuid.UUID) (*models.Invoice, error)
}

// InvoiceView is the full invoice response (invoice + order + items + payments).
type InvoiceView struct {
	Invoice *models.Invoice   `json:"invoice"`
	Order   *models.Order     `json:"order"`
	Payments []*models.Payment `json:"payments"`
}

type NotificationService interface {
	Create(ctx context.Context, pharmacyID, userID uuid.UUID, title, message, notifType string) (*models.Notification, error)
	ListByUser(ctx context.Context, userID uuid.UUID, unreadOnly bool, limit, offset int) ([]*models.Notification, error)
	CountUnreadByUser(ctx context.Context, userID uuid.UUID) (int64, error)
	MarkRead(ctx context.Context, id, userID uuid.UUID) error
	MarkAllRead(ctx context.Context, userID uuid.UUID) error
}

type InventoryService interface {
	AddBatch(ctx context.Context, pharmacyID, productID uuid.UUID, batchNumber string, quantity int, expiryDate *time.Time) (*models.InventoryBatch, error)
	ListBatchesByProduct(ctx context.Context, productID uuid.UUID) ([]*models.InventoryBatch, error)
	ListBatchesByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.InventoryBatch, error)
	ListExpiringSoon(ctx context.Context, pharmacyID uuid.UUID, withinDays int) ([]*models.InventoryBatch, error)
	GetBatch(ctx context.Context, id uuid.UUID) (*models.InventoryBatch, error)
	UpdateBatch(ctx context.Context, id uuid.UUID, quantity *int, expiryDate *time.Time) (*models.InventoryBatch, error)
	DeleteBatch(ctx context.Context, id uuid.UUID) error
	Consume(ctx context.Context, productID uuid.UUID, quantity int) error
	HasBatches(ctx context.Context, productID uuid.UUID) (bool, error)
}

// ProductReviewWithMeta is a review with like count, user_liked, and comment count.
type ProductReviewWithMeta struct {
	*models.ProductReview
	LikeCount    int64 `json:"like_count"`
	UserLiked    bool  `json:"user_liked"`
	CommentCount int64 `json:"comment_count"`
}

type ReviewService interface {
	Create(ctx context.Context, userID uuid.UUID, productID uuid.UUID, rating int, title, body string) (*models.ProductReview, error)
	GetByID(ctx context.Context, id uuid.UUID, userID *uuid.UUID) (*ProductReviewWithMeta, error)
	ListByProductID(ctx context.Context, productID uuid.UUID, userID *uuid.UUID, limit, offset int) ([]*ProductReviewWithMeta, error)
	Update(ctx context.Context, reviewID, userID uuid.UUID, rating *int, title, body *string) (*models.ProductReview, error)
	Delete(ctx context.Context, reviewID, userID uuid.UUID) error
	Like(ctx context.Context, reviewID, userID uuid.UUID) error
	Unlike(ctx context.Context, reviewID, userID uuid.UUID) error
	CreateComment(ctx context.Context, reviewID, userID uuid.UUID, body string, parentID *uuid.UUID) (*models.ReviewComment, error)
	ListComments(ctx context.Context, reviewID uuid.UUID, limit, offset int) ([]*models.ReviewComment, error)
	DeleteComment(ctx context.Context, commentID, userID uuid.UUID) error
}

type MembershipService interface {
	Create(ctx context.Context, m *models.Membership) error
	GetByID(ctx context.Context, id uuid.UUID) (*models.Membership, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID) ([]*models.Membership, error)
	Update(ctx context.Context, m *models.Membership) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type PromoService interface {
	Create(ctx context.Context, pharmacyID uuid.UUID, p *models.Promo) (*models.Promo, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.Promo, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, types []string, activeOnly bool) ([]*models.Promo, error)
	Update(ctx context.Context, pharmacyID uuid.UUID, p *models.Promo) (*models.Promo, error)
	Delete(ctx context.Context, pharmacyID, id uuid.UUID) error
}

// ReferralCodeValidateResult is returned when validating a referral code (public).
type ReferralCodeValidateResult struct {
	Valid   bool   `json:"valid"`
	Message string `json:"message,omitempty"`
	Name    string `json:"name,omitempty"` // referrer display name (e.g. first name)
}

// RedeemPointsResult is the result of computing points redemption for an order.
type RedeemPointsResult struct {
	DiscountAmount  float64 `json:"discount_amount"`
	PointsRedeemed  int     `json:"points_redeemed"`
	MaxRedeemable   int     `json:"max_redeemable"`   // max points allowed for this order
	PointsBalance   int     `json:"points_balance"`   // customer balance after (for display)
}

// CustomerWithMembership is returned by GetCustomerByPhoneWithMembership for billing UX.
type CustomerWithMembership struct {
	*models.Customer
	Membership *MembershipInfo `json:"membership,omitempty"`
}

// MembershipInfo is a minimal membership view (id, name) for customer display.
type MembershipInfo struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

type ReferralPointsService interface {
	GetOrCreateCustomer(ctx context.Context, pharmacyID uuid.UUID, name, phone, email string) (*models.Customer, error)
	ValidateReferralCode(ctx context.Context, pharmacyID uuid.UUID, code string) (*ReferralCodeValidateResult, error)
	GetConfig(ctx context.Context, pharmacyID uuid.UUID) (*models.ReferralPointsConfig, error)
	GetOrCreateConfig(ctx context.Context, pharmacyID uuid.UUID) (*models.ReferralPointsConfig, error)
	UpsertConfig(ctx context.Context, pharmacyID uuid.UUID, c *models.ReferralPointsConfig) (*models.ReferralPointsConfig, error)
	ComputeRedeemDiscount(ctx context.Context, pharmacyID uuid.UUID, customerID uuid.UUID, pointsToRedeem int, orderSubTotal float64) (*RedeemPointsResult, error)
	// PrepareOrderReferralAndPoints runs during order create: resolves/creates customer, applies referral code, applies points redeem; returns customerID, referralCodeUsed, pointsRedeemed, extraDiscountFromPoints.
	PrepareOrderReferralAndPoints(ctx context.Context, pharmacyID uuid.UUID, customerName, customerPhone, customerEmail string, referralCode *string, pointsToRedeem *int, subTotal float64) (customerID *uuid.UUID, referralCodeUsed string, pointsRedeemed int, discountFromPoints float64, err error)
	// ApplyPointsRedeem deducts points from customer and records the redeem transaction (call after order create when points_redeemed > 0).
	ApplyPointsRedeem(ctx context.Context, orderID, customerID uuid.UUID, pointsRedeemed int) error
	OnOrderCompleted(ctx context.Context, order *models.Order) error
	ListCustomers(ctx context.Context, pharmacyID uuid.UUID, limit, offset int) ([]*models.Customer, int64, error)
	GetCustomerByPhone(ctx context.Context, pharmacyID uuid.UUID, phone string) (*models.Customer, error)
	// GetCustomerByPhoneWithMembership returns customer with optional membership (id, name) for billing display.
	GetCustomerByPhoneWithMembership(ctx context.Context, pharmacyID uuid.UUID, phone string) (*CustomerWithMembership, error)
	ListPointsTransactions(ctx context.Context, customerID uuid.UUID, limit, offset int) ([]*models.PointsTransaction, error)
}

type AnnouncementService interface {
	Create(ctx context.Context, pharmacyID uuid.UUID, a *models.Announcement) (*models.Announcement, error)
	GetByID(ctx context.Context, id uuid.UUID) (*models.Announcement, error)
	ListByPharmacy(ctx context.Context, pharmacyID uuid.UUID, activeOnly bool) ([]*models.Announcement, error)
	Update(ctx context.Context, pharmacyID uuid.UUID, a *models.Announcement) (*models.Announcement, error)
	Delete(ctx context.Context, pharmacyID, id uuid.UUID) error
	// ListActiveForUser returns announcements to show on dashboard (not yet acked, within dates, and user has not "skip all" in last 24h).
	ListActiveForUser(ctx context.Context, pharmacyID, userID uuid.UUID) ([]*models.Announcement, error)
	// Acknowledge records that user dismissed one announcement or chose "skip all".
	Acknowledge(ctx context.Context, userID, announcementID uuid.UUID, skipAll bool) error
}

type ChatService interface {
	GetOrCreateConversation(ctx context.Context, pharmacyID, customerID uuid.UUID) (*models.Conversation, error)
	GetOrCreateConversationForUser(ctx context.Context, pharmacyID, userID uuid.UUID) (*models.Conversation, error)
	GetConversationByPharmacyAndCustomer(ctx context.Context, pharmacyID, customerID uuid.UUID) (*models.Conversation, error)
	ListConversations(ctx context.Context, pharmacyID uuid.UUID, userID *uuid.UUID, limit, offset int) ([]*models.Conversation, int64, error)
	GetConversationByID(ctx context.Context, conversationID, pharmacyID uuid.UUID, customerID *uuid.UUID, userID *uuid.UUID, role string) (*models.Conversation, error)
	ListMessages(ctx context.Context, conversationID, pharmacyID uuid.UUID, customerID *uuid.UUID, userID *uuid.UUID, role string, limit, offset int) ([]*models.ChatMessage, int64, error)
	SendMessage(ctx context.Context, conversationID uuid.UUID, senderType string, senderID uuid.UUID, body, attachmentURL, attachmentName, attachmentType string) (*models.ChatMessage, error)
	EditMessage(ctx context.Context, conversationID, messageID, pharmacyID uuid.UUID, customerID *uuid.UUID, userID *uuid.UUID, role string, body string) (*models.ChatMessage, error)
	DeleteMessage(ctx context.Context, conversationID, messageID, pharmacyID uuid.UUID, customerID *uuid.UUID, userID *uuid.UUID, role string) error
	DeleteConversation(ctx context.Context, conversationID, pharmacyID uuid.UUID, customerID *uuid.UUID, userID *uuid.UUID, role string) error
	GetChatEditWindowMinutes(ctx context.Context, pharmacyID uuid.UUID) int
}
