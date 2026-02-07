package models

import (
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	PharmacyID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"pharmacy_id"`
	Email         string         `gorm:"size:255;uniqueIndex;not null" json:"email"`
	PasswordHash  string         `gorm:"size:255;not null" json:"-"`
	Name          string         `gorm:"size:255" json:"name"`
	Role          string         `gorm:"size:50;default:staff" json:"role"` // admin, manager, pharmacist, staff
	PointsBalance int            `gorm:"default:0" json:"points_balance"`   // earned from completed sales (pharmacist/staff)
	IsActive      bool           `gorm:"default:true" json:"is_active"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	// Pharmacist-only profile fields (optional for other roles)
	LicenseNumber string     `gorm:"size:100" json:"license_number,omitempty"`
	Qualification string     `gorm:"size:255" json:"qualification,omitempty"`
	CVURL         string     `gorm:"size:512" json:"cv_url,omitempty"`
	PhotoURL      string     `gorm:"size:512" json:"photo_url,omitempty"`
	DateOfBirth   *time.Time `json:"date_of_birth,omitempty"`
	Gender        string     `gorm:"size:50" json:"gender,omitempty"`
	Phone         string     `gorm:"size:50" json:"phone,omitempty"`

	Pharmacy *Pharmacy `gorm:"foreignKey:PharmacyID" json:"pharmacy,omitempty"`
}

func (User) TableName() string { return "users" }

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

func (u *User) SetPassword(plain string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.PasswordHash = string(hash)
	return nil
}

func (u *User) CheckPassword(plain string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(plain))
	return err == nil
}
