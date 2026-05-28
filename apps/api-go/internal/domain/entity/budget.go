package entity

import (
	"time"

	"github.com/google/uuid"
)

type Budget struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID     uuid.UUID  `gorm:"type:uuid;not null;index" json:"userId"`
	CategoryID *uuid.UUID `gorm:"type:uuid;index" json:"categoryId,omitempty"`
	Name       string     `gorm:"not null;size:255" json:"name"`
	Amount     float64    `gorm:"type:numeric(15,2);not null" json:"amount"`
	Currency   string     `gorm:"default:IDR;not null;size:3" json:"currency"`
	Period     string     `gorm:"default:monthly;not null;size:20" json:"period"` // monthly|weekly|yearly|custom
	StartDate  time.Time  `gorm:"not null" json:"startDate"`
	EndDate    *time.Time `json:"endDate,omitempty"`
	IsActive   bool       `gorm:"default:true;not null" json:"isActive"`
	CarryOver  bool       `gorm:"default:false" json:"carryOver"`
	AlertAt80  bool       `gorm:"default:true" json:"alertAt80"`
	AlertAt100 bool       `gorm:"default:true" json:"alertAt100"`
	AlertAt120 bool       `gorm:"default:false" json:"alertAt120"`
	CreatedAt  time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`

	Category *Category `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
}

func (Budget) TableName() string {
	return "budgets"
}

type Subscription struct {
	ID                 uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID             uuid.UUID  `gorm:"type:uuid;not null;index" json:"userId"`
	CategoryID         *uuid.UUID `gorm:"type:uuid" json:"categoryId,omitempty"`
	Name               string     `gorm:"not null;size:255" json:"name"`
	Merchant           *string    `gorm:"size:255" json:"merchant,omitempty"`
	Amount             float64    `gorm:"type:numeric(15,2);not null" json:"amount"`
	Currency           string     `gorm:"default:IDR;not null;size:3" json:"currency"`
	BillingCycle       string     `gorm:"default:monthly;not null;size:20" json:"billingCycle"`
	NextBillingDate    *time.Time `json:"nextBillingDate,omitempty"`
	IsActive           bool       `gorm:"default:true;not null" json:"isActive"`
	IsAutoDetected     bool       `gorm:"default:false" json:"isAutoDetected"`
	ReminderDaysBefore int        `gorm:"default:3" json:"reminderDaysBefore"`
	CreatedAt          time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (Subscription) TableName() string {
	return "subscriptions"
}
