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

type orderService struct {
	orderRepo              outbound.OrderRepository
	productRepo            outbound.ProductRepository
	inventoryService       inbound.InventoryService
	promoCodeRepo          outbound.PromoCodeRepository
	promoCodeSvc           inbound.PromoCodeService
	customerRepo           outbound.CustomerRepository
	customerMembershipRepo outbound.CustomerMembershipRepository
	referralPointsSvc      inbound.ReferralPointsService
	logger                 *zap.Logger
}

func NewOrderService(orderRepo outbound.OrderRepository, productRepo outbound.ProductRepository, inventoryService inbound.InventoryService, promoCodeRepo outbound.PromoCodeRepository, promoCodeSvc inbound.PromoCodeService, customerRepo outbound.CustomerRepository, customerMembershipRepo outbound.CustomerMembershipRepository, referralPointsSvc inbound.ReferralPointsService, logger *zap.Logger) inbound.OrderService {
	return &orderService{orderRepo: orderRepo, productRepo: productRepo, inventoryService: inventoryService, promoCodeRepo: promoCodeRepo, promoCodeSvc: promoCodeSvc, customerRepo: customerRepo, customerMembershipRepo: customerMembershipRepo, referralPointsSvc: referralPointsSvc, logger: logger}
}

func (s *orderService) Create(ctx context.Context, pharmacyID, createdBy uuid.UUID, customerName, customerPhone, customerEmail string, items []inbound.OrderItemInput, notes string, discountAmount *float64, promoCode *string, referralCode *string, pointsToRedeem *int) (*models.Order, error) {
	if len(items) == 0 {
		return nil, errors.ErrValidation("at least one item is required")
	}
	var subTotal float64
	for _, it := range items {
		if it.Quantity <= 0 {
			return nil, errors.ErrValidation("quantity must be positive")
		}
		prod, err := s.productRepo.GetByID(ctx, it.ProductID)
		if err != nil || prod == nil {
			return nil, errors.ErrNotFound("product")
		}
		if prod.PharmacyID != pharmacyID {
			return nil, errors.ErrForbidden("product does not belong to this pharmacy")
		}
		if prod.StockQuantity < it.Quantity {
			return nil, errors.ErrValidation("insufficient stock for " + prod.Name)
		}
		subTotal += it.UnitPrice * float64(it.Quantity)
	}

	discount := 0.0
	var promoCodeID *uuid.UUID
	var customerID *uuid.UUID
	referralCodeUsed := ""
	pointsRedeemed := 0
	discountFromPoints := 0.0

	if s.referralPointsSvc != nil {
		cid, rcu, pr, dfp, err := s.referralPointsSvc.PrepareOrderReferralAndPoints(ctx, pharmacyID, customerName, customerPhone, customerEmail, referralCode, pointsToRedeem, subTotal)
		if err != nil {
			return nil, err
		}
		customerID = cid
		referralCodeUsed = rcu
		pointsRedeemed = pr
		discountFromPoints = dfp
	}
	if customerID == nil && customerPhone != "" {
		cust, _ := s.customerRepo.GetByPharmacyAndPhone(ctx, pharmacyID, customerPhone)
		if cust != nil {
			customerID = &cust.ID
		}
		if referralCodeUsed == "" && referralCode != nil {
			referralCodeUsed = *referralCode
		}
		if pointsRedeemed == 0 && pointsToRedeem != nil && *pointsToRedeem > 0 {
			pointsRedeemed = *pointsToRedeem
		}
	}

	// Membership discount (if customer exists)
	if customerID != nil {
		cm, _ := s.customerMembershipRepo.GetByCustomerID(ctx, *customerID)
		if cm != nil && cm.Membership != nil && cm.Membership.IsActive && cm.Membership.DiscountPercent > 0 {
			discount += subTotal * (cm.Membership.DiscountPercent / 100)
		}
	}

	if promoCode != nil && *promoCode != "" {
		result, err := s.promoCodeSvc.Validate(ctx, pharmacyID, *promoCode, subTotal, &createdBy)
		if err != nil {
			return nil, err
		}
		discount += result.DiscountAmount
		promoCodeID = &result.PromoCodeID
	} else if discountAmount != nil && *discountAmount > 0 {
		discount += *discountAmount
	}
	discount += discountFromPoints
	if discount > subTotal {
		discount = subTotal
	}

	totalAmount := subTotal - discount
	if totalAmount < 0 {
		totalAmount = 0
	}

	o := &models.Order{
		PharmacyID:       pharmacyID,
		CustomerName:     customerName,
		CustomerPhone:    customerPhone,
		CustomerEmail:    customerEmail,
		CustomerID:       customerID,
		Status:           models.OrderStatusPending,
		SubTotal:         subTotal,
		TaxAmount:        0,
		DiscountAmount:   discount,
		PromoCodeID:      promoCodeID,
		TotalAmount:      totalAmount,
		Currency:         "NPR",
		Notes:            notes,
		CreatedBy:        createdBy,
		ReferralCodeUsed: referralCodeUsed,
		PointsRedeemed:   pointsRedeemed,
	}
	if err := s.orderRepo.Create(ctx, o); err != nil {
		return nil, errors.ErrInternal("failed to create order", err)
	}
	if promoCodeID != nil {
		_ = s.promoCodeRepo.IncrementUsedCount(ctx, *promoCodeID)
	}
	if pointsRedeemed > 0 && customerID != nil && s.referralPointsSvc != nil {
		if err := s.referralPointsSvc.ApplyPointsRedeem(ctx, o.ID, *customerID, pointsRedeemed); err != nil {
			return nil, err
		}
	}
	for _, it := range items {
		item := &models.OrderItem{
			OrderID:    o.ID,
			ProductID:  it.ProductID,
			Quantity:   it.Quantity,
			UnitPrice:  it.UnitPrice,
			TotalPrice: it.UnitPrice * float64(it.Quantity),
		}
		if err := s.orderRepo.CreateItem(ctx, item); err != nil {
			return nil, errors.ErrInternal("failed to create order item", err)
		}
		if err := s.inventoryService.Consume(ctx, it.ProductID, it.Quantity); err != nil {
			return nil, err
		}
	}
	return s.orderRepo.GetByID(ctx, o.ID)
}

func (s *orderService) GetByID(ctx context.Context, id uuid.UUID) (*models.Order, error) {
	return s.orderRepo.GetByID(ctx, id)
}

func (s *orderService) List(ctx context.Context, pharmacyID uuid.UUID, status *string) ([]*models.Order, error) {
	return s.orderRepo.ListByPharmacy(ctx, pharmacyID, status)
}

// validTransitions defines allowed next statuses from each current status.
var validTransitions = map[models.OrderStatus][]models.OrderStatus{
	models.OrderStatusPending:   {models.OrderStatusConfirmed, models.OrderStatusCancelled},
	models.OrderStatusConfirmed: {models.OrderStatusProcessing, models.OrderStatusCancelled},
	models.OrderStatusProcessing: {models.OrderStatusReady, models.OrderStatusCancelled},
	models.OrderStatusReady:     {models.OrderStatusCompleted, models.OrderStatusCancelled},
	models.OrderStatusCompleted: {}, // terminal
	models.OrderStatusCancelled: {}, // terminal
}

func (s *orderService) canTransition(from, to models.OrderStatus) bool {
	if from == to {
		return true
	}
	allowed := validTransitions[from]
	for _, a := range allowed {
		if a == to {
			return true
		}
	}
	return false
}

func (s *orderService) UpdateStatus(ctx context.Context, orderID uuid.UUID, status models.OrderStatus) (*models.Order, error) {
	o, err := s.orderRepo.GetByID(ctx, orderID)
	if err != nil || o == nil {
		return nil, errors.ErrNotFound("order")
	}
	if !s.canTransition(o.Status, status) {
		return nil, errors.ErrValidation("invalid status transition from " + string(o.Status) + " to " + string(status))
	}
	wasCompleted := o.Status == models.OrderStatusCompleted
	o.Status = status
	if err := s.orderRepo.Update(ctx, o); err != nil {
		return nil, errors.ErrInternal("failed to update order status", err)
	}
	if !wasCompleted && status == models.OrderStatusCompleted && s.referralPointsSvc != nil {
		_ = s.referralPointsSvc.OnOrderCompleted(ctx, o)
	}
	return s.orderRepo.GetByID(ctx, orderID)
}

func (s *orderService) Accept(ctx context.Context, orderID uuid.UUID) (*models.Order, error) {
	o, err := s.orderRepo.GetByID(ctx, orderID)
	if err != nil || o == nil {
		return nil, errors.ErrNotFound("order")
	}
	if o.Status != models.OrderStatusPending {
		return nil, errors.ErrValidation("only pending orders can be accepted")
	}
	o.Status = models.OrderStatusConfirmed
	if err := s.orderRepo.Update(ctx, o); err != nil {
		return nil, errors.ErrInternal("failed to accept order", err)
	}
	return s.orderRepo.GetByID(ctx, orderID)
}
