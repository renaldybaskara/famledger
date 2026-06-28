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
	Period             string     `gorm:"size:20" json:"period"`                       // "monthly"|"annual"|"lifetime"
	Status             string     `gorm:"not null;size:20;default:free" json:"status"` // trialing|active|past_due|canceled|free
	TrialEndsAt        *time.Time `json:"trialEndsAt,omitempty"`
	CurrentPeriodStart *time.Time `json:"currentPeriodStart,omitempty"`
	CurrentPeriodEnd   *time.Time `json:"currentPeriodEnd,omitempty"`
	CanceledAt         *time.Time `json:"canceledAt,omitempty"`
	GracePeriodEndsAt  *time.Time `json:"gracePeriodEndsAt,omitempty"`
	// RevenueCat identifiers
	RevenueCatAppUserID string `gorm:"size:200" json:"-"`
	ProductID           string `gorm:"size:200" json:"productId,omitempty"`
	// Midtrans order ID and agreed period for the most recent pending web payment
	MidtransOrderID *string `gorm:"size:200" json:"-"`
	PendingPeriod   *string `gorm:"size:20" json:"-"`
	// TrialEligible is a computed (non-persisted) field set to true when no subscription
	// row exists yet — i.e. the user has never started or declined a trial.
	// Used by the frontend to decide whether to show the trial opt-in popup.
	TrialEligible bool `gorm:"-" json:"trialEligible"`
	CreatedAt           time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt           time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (UserSubscription) TableName() string { return "user_subscriptions" }
