package services

import (
	"context"
	"crypto/rand"
	"math/big"
	"strings"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

const referralCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0,O,1,I to avoid confusion
const referralCodeLen = 8

type referralPointsService struct {
	customerRepo           outbound.CustomerRepository
	customerMembershipRepo outbound.CustomerMembershipRepository
	pointsRepo            outbound.PointsTransactionRepository
	configRepo            outbound.ReferralPointsConfigRepository
	orderRepo             outbound.OrderRepository
	logger                *zap.Logger
}

func NewReferralPointsService(
	customerRepo outbound.CustomerRepository,
	customerMembershipRepo outbound.CustomerMembershipRepository,
	pointsRepo outbound.PointsTransactionRepository,
	configRepo outbound.ReferralPointsConfigRepository,
	orderRepo outbound.OrderRepository,
	logger *zap.Logger,
) inbound.ReferralPointsService {
	return &referralPointsService{
		customerRepo:           customerRepo,
		customerMembershipRepo: customerMembershipRepo,
		pointsRepo:             pointsRepo,
		configRepo:             configRepo,
		orderRepo:              orderRepo,
		logger:                 logger,
	}
}

func (s *referralPointsService) generateReferralCode(ctx context.Context, pharmacyID uuid.UUID) (string, error) {
	for i := 0; i < 20; i++ {
		var b strings.Builder
		for j := 0; j < referralCodeLen; j++ {
			n, err := rand.Int(rand.Reader, big.NewInt(int64(len(referralCodeChars))))
			if err != nil {
				return "", err
			}
			b.WriteByte(referralCodeChars[n.Int64()])
		}
		code := strings.ToUpper(b.String())
		existing, err := s.customerRepo.GetByPharmacyAndReferralCode(ctx, pharmacyID, code)
		if err != nil || existing == nil {
			return code, nil
		}
	}
	return "", errors.ErrInternal("failed to generate unique referral code", nil)
}

func (s *referralPointsService) GetOrCreateCustomer(ctx context.Context, pharmacyID uuid.UUID, name, phone, email string) (*models.Customer, error) {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return nil, errors.ErrValidation("phone is required to identify customer")
	}
	email = strings.TrimSpace(email)
	c, err := s.customerRepo.GetByPharmacyAndPhone(ctx, pharmacyID, phone)
	if err == nil && c != nil {
		if name != "" {
			c.Name = name
		}
		if email != "" {
			c.Email = email
		}
		if c.ReferralCode == "" {
			code, genErr := s.generateReferralCode(ctx, pharmacyID)
			if genErr == nil {
				c.ReferralCode = code
			}
		}
		_ = s.customerRepo.Update(ctx, c)
		return c, nil
	}
	code, err := s.generateReferralCode(ctx, pharmacyID)
	if err != nil {
		return nil, err
	}
	c = &models.Customer{
		PharmacyID:    pharmacyID,
		Name:          strings.TrimSpace(name),
		Phone:         phone,
		Email:         email,
		ReferralCode:  code,
		PointsBalance: 0,
	}
	if err := s.customerRepo.Create(ctx, c); err != nil {
		return nil, errors.ErrInternal("failed to create customer", err)
	}
	return c, nil
}

func (s *referralPointsService) ValidateReferralCode(ctx context.Context, pharmacyID uuid.UUID, code string) (*inbound.ReferralCodeValidateResult, error) {
	code = strings.TrimSpace(strings.ToUpper(code))
	if code == "" {
		return &inbound.ReferralCodeValidateResult{Valid: false, Message: "code is required"}, nil
	}
	c, err := s.customerRepo.GetByPharmacyAndReferralCode(ctx, pharmacyID, code)
	if err != nil || c == nil {
		return &inbound.ReferralCodeValidateResult{Valid: false, Message: "invalid or expired code"}, nil
	}
	name := c.Name
	if name == "" {
		name = "A friend"
	} else if idx := strings.Index(name, " "); idx > 0 {
		name = name[:idx]
	}
	return &inbound.ReferralCodeValidateResult{Valid: true, Name: name}, nil
}

func (s *referralPointsService) GetConfig(ctx context.Context, pharmacyID uuid.UUID) (*models.ReferralPointsConfig, error) {
	return s.configRepo.GetByPharmacyID(ctx, pharmacyID)
}

func (s *referralPointsService) GetOrCreateConfig(ctx context.Context, pharmacyID uuid.UUID) (*models.ReferralPointsConfig, error) {
	c, err := s.configRepo.GetByPharmacyID(ctx, pharmacyID)
	if err == nil && c != nil {
		return c, nil
	}
	c = &models.ReferralPointsConfig{
		PharmacyID:                pharmacyID,
		PointsPerCurrencyUnit:     1,
		CurrencyUnitForPoints:     10,
		ReferralRewardPoints:      50,
		RedemptionRatePoints:     100,
		RedemptionRateCurrency:    10,
		MaxRedeemPointsPerOrder:  0,
	}
	if err := s.configRepo.Create(ctx, c); err != nil {
		return nil, errors.ErrInternal("failed to create referral points config", err)
	}
	return c, nil
}

func (s *referralPointsService) UpsertConfig(ctx context.Context, pharmacyID uuid.UUID, c *models.ReferralPointsConfig) (*models.ReferralPointsConfig, error) {
	c.PharmacyID = pharmacyID
	existing, err := s.configRepo.GetByPharmacyID(ctx, pharmacyID)
	if err != nil || existing == nil {
		if err := s.configRepo.Create(ctx, c); err != nil {
			return nil, errors.ErrInternal("failed to create referral points config", err)
		}
		return c, nil
	}
	existing.PointsPerCurrencyUnit = c.PointsPerCurrencyUnit
	existing.CurrencyUnitForPoints = c.CurrencyUnitForPoints
	existing.ReferralRewardPoints = c.ReferralRewardPoints
	existing.RedemptionRatePoints = c.RedemptionRatePoints
	existing.RedemptionRateCurrency = c.RedemptionRateCurrency
	existing.MaxRedeemPointsPerOrder = c.MaxRedeemPointsPerOrder
	if err := s.configRepo.Update(ctx, existing); err != nil {
		return nil, errors.ErrInternal("failed to update referral points config", err)
	}
	return existing, nil
}

func (s *referralPointsService) ComputeRedeemDiscount(ctx context.Context, pharmacyID uuid.UUID, customerID uuid.UUID, pointsToRedeem int, orderSubTotal float64) (*inbound.RedeemPointsResult, error) {
	cfg, err := s.GetConfig(ctx, pharmacyID)
	if err != nil || cfg == nil {
		return nil, errors.ErrNotFound("referral points config")
	}
	c, err := s.customerRepo.GetByID(ctx, customerID)
	if err != nil || c == nil {
		return nil, errors.ErrNotFound("customer")
	}
	if pointsToRedeem <= 0 {
		return &inbound.RedeemPointsResult{PointsBalance: c.PointsBalance}, nil
	}
	maxByBalance := c.PointsBalance
	maxByOrder := 0
	if cfg.MaxRedeemPointsPerOrder > 0 {
		maxByOrder = cfg.MaxRedeemPointsPerOrder
	} else {
		maxByOrder = maxByBalance
	}
	maxRedeemable := maxByBalance
	if maxByOrder < maxRedeemable {
		maxRedeemable = maxByOrder
	}
	if pointsToRedeem > maxRedeemable {
		pointsToRedeem = maxRedeemable
	}
	if pointsToRedeem <= 0 {
		return &inbound.RedeemPointsResult{MaxRedeemable: 0, PointsBalance: c.PointsBalance}, nil
	}
	// discount = floor(points / rate_points) * rate_currency
	if cfg.RedemptionRatePoints <= 0 {
		return nil, errors.ErrValidation("invalid redemption rate")
	}
	discountUnits := pointsToRedeem / cfg.RedemptionRatePoints
	discountAmount := float64(discountUnits) * cfg.RedemptionRateCurrency
	if discountAmount > orderSubTotal {
		discountAmount = orderSubTotal
		pointsToRedeem = int(discountAmount / cfg.RedemptionRateCurrency) * cfg.RedemptionRatePoints
		if pointsToRedeem > c.PointsBalance {
			pointsToRedeem = c.PointsBalance
		}
		discountAmount = float64(pointsToRedeem/cfg.RedemptionRatePoints) * cfg.RedemptionRateCurrency
	}
	return &inbound.RedeemPointsResult{
		DiscountAmount: discountAmount,
		PointsRedeemed: pointsToRedeem,
		MaxRedeemable:  maxRedeemable,
		PointsBalance:  c.PointsBalance - pointsToRedeem,
	}, nil
}

func (s *referralPointsService) PrepareOrderReferralAndPoints(ctx context.Context, pharmacyID uuid.UUID, customerName, customerPhone, customerEmail string, referralCode *string, pointsToRedeem *int, subTotal float64) (customerID *uuid.UUID, referralCodeUsed string, pointsRedeemed int, discountFromPoints float64, err error) {
	cfg, _ := s.GetConfig(ctx, pharmacyID)
	if cfg == nil {
		return nil, "", 0, 0, nil
	}
	c, err := s.GetOrCreateCustomer(ctx, pharmacyID, customerName, customerPhone, customerEmail)
	if err != nil {
		return nil, "", 0, 0, err
	}
	cid := c.ID
	customerID = &cid

	code := ""
	if referralCode != nil {
		code = strings.TrimSpace(strings.ToUpper(*referralCode))
	}
	if code != "" && c.ReferredByID == nil {
		referrer, err := s.customerRepo.GetByPharmacyAndReferralCode(ctx, pharmacyID, code)
		if err == nil && referrer != nil && referrer.ID != c.ID {
			c.ReferredByID = &referrer.ID
			_ = s.customerRepo.Update(ctx, c)
			referralCodeUsed = code
		}
	}

	discountFromPoints = 0
	if pointsToRedeem != nil && *pointsToRedeem > 0 {
		res, err := s.ComputeRedeemDiscount(ctx, pharmacyID, c.ID, *pointsToRedeem, subTotal)
		if err != nil {
			return nil, "", 0, 0, err
		}
		if res.PointsRedeemed > 0 {
			pointsRedeemed = res.PointsRedeemed
			discountFromPoints = res.DiscountAmount
		}
	}
	return customerID, referralCodeUsed, pointsRedeemed, discountFromPoints, nil
}

func (s *referralPointsService) ApplyPointsRedeem(ctx context.Context, orderID, customerID uuid.UUID, pointsRedeemed int) error {
	if pointsRedeemed <= 0 {
		return nil
	}
	c, err := s.customerRepo.GetByID(ctx, customerID)
	if err != nil || c == nil {
		return errors.ErrNotFound("customer")
	}
	if c.PointsBalance < pointsRedeemed {
		return errors.ErrValidation("insufficient points balance")
	}
	c.PointsBalance -= pointsRedeemed
	if err := s.customerRepo.Update(ctx, c); err != nil {
		return errors.ErrInternal("failed to deduct points", err)
	}
	tx := &models.PointsTransaction{
		CustomerID: c.ID,
		Amount:     -pointsRedeemed,
		Type:       models.PointsTransactionTypeRedeem,
		OrderID:    &orderID,
	}
	return s.pointsRepo.Create(ctx, tx)
}

func (s *referralPointsService) OnOrderCompleted(ctx context.Context, order *models.Order) error {
	cfg, err := s.GetConfig(ctx, order.PharmacyID)
	if err != nil || cfg == nil {
		return nil
	}
	if order.CustomerID != nil {
		c, err := s.customerRepo.GetByID(ctx, *order.CustomerID)
		if err != nil || c == nil {
			return nil
		}
		pointsEarned := 0
		if cfg.CurrencyUnitForPoints > 0 && cfg.PointsPerCurrencyUnit > 0 {
			units := int(order.TotalAmount / cfg.CurrencyUnitForPoints)
			pointsEarned = int(float64(units) * cfg.PointsPerCurrencyUnit)
		}
		if pointsEarned > 0 {
			c.PointsBalance += pointsEarned
			if err := s.customerRepo.Update(ctx, c); err != nil {
				s.logger.Warn("failed to update customer points", zap.Error(err))
				return nil
			}
			tx := &models.PointsTransaction{
				CustomerID: c.ID,
				Amount:     pointsEarned,
				Type:       models.PointsTransactionTypeEarnPurchase,
				OrderID:    &order.ID,
			}
			_ = s.pointsRepo.Create(ctx, tx)
		}
	}
	if order.ReferralCodeUsed != "" && order.CustomerID != nil {
		count, err := s.orderRepo.CountByCustomerIDAndStatus(ctx, *order.CustomerID, string(models.OrderStatusCompleted))
		if err != nil || count != 1 {
			return nil
		}
		referrer, err := s.customerRepo.GetByPharmacyAndReferralCode(ctx, order.PharmacyID, order.ReferralCodeUsed)
		if err != nil || referrer == nil {
			return nil
		}
		reward := cfg.ReferralRewardPoints
		if reward > 0 {
			referrer.PointsBalance += reward
			if err := s.customerRepo.Update(ctx, referrer); err != nil {
				s.logger.Warn("failed to update referrer points", zap.Error(err))
				return nil
			}
			refTx := &models.PointsTransaction{
				CustomerID:         referrer.ID,
				Amount:             reward,
				Type:               models.PointsTransactionTypeEarnReferral,
				OrderID:            &order.ID,
				ReferralCustomerID: order.CustomerID,
			}
			_ = s.pointsRepo.Create(ctx, refTx)
		}
	}
	return nil
}

func (s *referralPointsService) ListCustomers(ctx context.Context, pharmacyID uuid.UUID, limit, offset int) ([]*models.Customer, int64, error) {
	return s.customerRepo.ListByPharmacy(ctx, pharmacyID, limit, offset)
}

func (s *referralPointsService) GetCustomerByPhone(ctx context.Context, pharmacyID uuid.UUID, phone string) (*models.Customer, error) {
	return s.customerRepo.GetByPharmacyAndPhone(ctx, pharmacyID, strings.TrimSpace(phone))
}

func (s *referralPointsService) GetCustomerByPhoneWithMembership(ctx context.Context, pharmacyID uuid.UUID, phone string) (*inbound.CustomerWithMembership, error) {
	cust, err := s.customerRepo.GetByPharmacyAndPhone(ctx, pharmacyID, strings.TrimSpace(phone))
	if err != nil || cust == nil {
		return nil, err
	}
	out := &inbound.CustomerWithMembership{Customer: cust}
	cm, err := s.customerMembershipRepo.GetByCustomerID(ctx, cust.ID)
	if err != nil || cm == nil {
		return out, nil
	}
	if cm.Membership != nil && cm.Membership.IsActive {
		out.Membership = &inbound.MembershipInfo{ID: cm.Membership.ID, Name: cm.Membership.Name}
	}
	return out, nil
}

func (s *referralPointsService) ListPointsTransactions(ctx context.Context, customerID uuid.UUID, limit, offset int) ([]*models.PointsTransaction, error) {
	if limit <= 0 {
		limit = 50
	}
	return s.pointsRepo.ListByCustomer(ctx, customerID, limit, offset)
}
