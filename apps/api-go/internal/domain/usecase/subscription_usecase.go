package usecase

import (
	"context"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

// MidtransPaymentResult holds data returned to the frontend to open the Snap popup.
type MidtransPaymentResult struct {
	SnapToken string `json:"snapToken"`
	ClientKey string `json:"clientKey"`
	OrderID   string `json:"orderId"`
}

// MidtransWebhookPayload is the relevant subset of a Midtrans notification.
type MidtransWebhookPayload struct {
	OrderID           string `json:"order_id"`
	StatusCode        string `json:"status_code"`
	GrossAmount       string `json:"gross_amount"`
	TransactionStatus string `json:"transaction_status"`
	FraudStatus       string `json:"fraud_status"`
	SignatureKey      string `json:"signature_key"`
}

type SubscriptionUseCase interface {
	GetStatus(ctx context.Context, userID uuid.UUID) (*entity.UserSubscription, error)
	CreateTrial(ctx context.Context, userID uuid.UUID) error
	Cancel(ctx context.Context, userID uuid.UUID) error
	HandleRevenueCatWebhook(ctx context.Context, payload map[string]interface{}) error
	// Midtrans — web payment gateway
	CreateMidtransPayment(ctx context.Context, userID uuid.UUID, plan, period, email, name string) (*MidtransPaymentResult, error)
	ConfirmMidtransPayment(ctx context.Context, userID uuid.UUID) error
	HandleMidtransWebhook(ctx context.Context, payload MidtransWebhookPayload) error
	IsProActive(ctx context.Context, userID uuid.UUID) bool
}
