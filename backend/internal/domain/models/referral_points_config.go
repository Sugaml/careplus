package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ReferralPointsConfig holds per-pharmacy rules for earning and redeeming points.
// If missing for a pharmacy, referral/points features are disabled (no earn, no redeem).
type ReferralPointsConfig struct {
	ID                        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID                uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex" json:"pharmacy_id"`
	PointsPerCurrencyUnit     float64        `gorm:"type:decimal(12,4);not null;default:0" json:"points_per_currency_unit"`     // e.g. 1 point per 10 NPR
	CurrencyUnitForPoints     float64        `gorm:"type:decimal(12,2);not null;default:1" json:"currency_unit_for_points"`   // e.g. 10 = 1 point per 10 NPR
	ReferralRewardPoints      int            `gorm:"not null;default:0" json:"referral_reward_points"`
	RedemptionRatePoints      int            `gorm:"not null;default:100" json:"redemption_rate_points"`      // e.g. 100 points
	RedemptionRateCurrency    float64        `gorm:"type:decimal(12,2);not null;default:10" json:"redemption_rate_currency"` // e.g. 10 NPR per 100 points
	MaxRedeemPointsPerOrder   int            `gorm:"not null;default:0" json:"max_redeem_points_per_order"`  // 0 = no cap
	CreatedAt                 time.Time      `json:"created_at"`
	UpdatedAt                 time.Time      `json:"updated_at"`
	DeletedAt                 gorm.DeletedAt `gorm:"index" json:"-"`

	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
}

func (ReferralPointsConfig) TableName() string { return "referral_points_configs" }

func (r *ReferralPointsConfig) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}
