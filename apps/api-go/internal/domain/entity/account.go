package entity

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Account struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID        uuid.UUID `gorm:"type:uuid;not null;index" json:"userId"`
	Name          string    `gorm:"not null;size:255" json:"name"`
	Type          string    `gorm:"not null;size:30" json:"type"` // bank|credit|investment
	BankCode      *string   `gorm:"size:50" json:"bankCode,omitempty"`
	AccountNumber *string   `gorm:"size:50" json:"accountNumber,omitempty"`
	Balance       float64   `gorm:"type:numeric(15,2);default:0;not null" json:"balance"`
	Currency      string    `gorm:"default:IDR;not null;size:3" json:"currency"`
	Color         string    `gorm:"default:#1A2B4A;size:7" json:"color"`
	Icon          string    `gorm:"default:wallet;size:50" json:"icon"`
	IsActive      bool      `gorm:"default:true;not null" json:"isActive"`
	IsDefault     bool      `gorm:"default:false;not null" json:"isDefault"`
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (Account) TableName() string {
	return "accounts"
}

type EmailIntegration struct {
	ID                uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID            uuid.UUID  `gorm:"type:uuid;not null;index" json:"userId"`
	Email             string     `gorm:"not null;size:255" json:"email"`
	Provider          string     `gorm:"not null;size:50" json:"provider"`
	AccessToken       *string    `json:"-"`
	RefreshToken      *string    `json:"-"`
	WatchResourceName *string    `json:"-"`
	WatchExpiration   *time.Time `json:"watchExpiration,omitempty"`
	IsActive          bool           `gorm:"default:true;not null" json:"isActive"`
	LastSyncAt        *time.Time     `json:"lastSyncAt,omitempty"`
	CreatedAt         time.Time      `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt         time.Time      `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

func (EmailIntegration) TableName() string {
	return "email_integrations"
}
