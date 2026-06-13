package usecase

import (
	"context"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type CheckoutInput struct {
	Plan   string // "pro"
	Period string // "monthly"|"annual"
}

type CheckoutOutput struct {
	SnapToken       string `json:"snapToken"`
	MidtransOrderID string `json:"midtransOrderId"`
	Amount          int64  `json:"amount"`
	RedirectURL     string `json:"redirectUrl,omitempty"`
}

type SubscriptionUseCase interface {
	GetStatus(ctx context.Context, userID uuid.UUID) (*entity.UserSubscription, error)
	CreateTrial(ctx context.Context, userID uuid.UUID) error
	Checkout(ctx context.Context, userID uuid.UUID, in CheckoutInput) (*CheckoutOutput, error)
	HandleWebhook(ctx context.Context, payload map[string]interface{}) error
	Cancel(ctx context.Context, userID uuid.UUID) error
	GetHistory(ctx context.Context, userID uuid.UUID) ([]entity.PaymentOrder, error)
	IsProActive(ctx context.Context, userID uuid.UUID) bool
}
