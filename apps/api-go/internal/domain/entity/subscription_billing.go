package entity

import (
	"time"

	"github.com/google/uuid"
)

// UserSubscription tracks a user's current subscription state.
// One row per user, upserted on every plan change.
type UserSubscription struct {
	ID                 uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID             uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex" json:"userId"`
	Plan               string     `gorm:"not null;size:20;default:free" json:"plan"`  // "free"|"pro"
	Period             string     `gorm:"size:20" json:"period"`                       // "monthly"|"annual"
	Status             string     `gorm:"not null;size:20;default:free" json:"status"` // trialing|active|past_due|canceled|free
	TrialEndsAt        *time.Time `json:"trialEndsAt,omitempty"`
	CurrentPeriodStart *time.Time `json:"currentPeriodStart,omitempty"`
	CurrentPeriodEnd   *time.Time `json:"currentPeriodEnd,omitempty"`
	CanceledAt         *time.Time `json:"canceledAt,omitempty"`
	GracePeriodEndsAt  *time.Time `json:"gracePeriodEndsAt,omitempty"`
	CreatedAt          time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (UserSubscription) TableName() string { return "user_subscriptions" }

// PaymentOrder records every Midtrans checkout attempt.
type PaymentOrder struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID          uuid.UUID  `gorm:"type:uuid;not null;index" json:"userId"`
	MidtransOrderID string     `gorm:"not null;uniqueIndex;size:100" json:"midtransOrderId"`
	SnapToken       string     `gorm:"not null;size:500" json:"snapToken"`
	Plan            string     `gorm:"not null;size:20" json:"plan"`
	Period          string     `gorm:"not null;size:20" json:"period"`
	Amount          float64    `gorm:"type:numeric(15,2);not null" json:"amount"`
	Status          string     `gorm:"not null;size:30;default:pending" json:"status"` // pending|paid|expired|failed|cancel
	PaidAt          *time.Time `json:"paidAt,omitempty"`
	CreatedAt       time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt       time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (PaymentOrder) TableName() string { return "payment_orders" }
