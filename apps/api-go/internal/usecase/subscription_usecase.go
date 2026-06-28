package usecase

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/fintrackr/api/internal/infrastructure/payment"
	"github.com/google/uuid"
)

const (
	trialDays       = 14
	gracePeriodDays = 3
)

var (
	ErrSubscriptionNotFound  = errors.New("subscription not found")
	ErrMidtransNotConfigured = errors.New("web payment not configured")
)

type subscriptionUseCase struct {
	subRepo           domainrepo.SubscriptionRepository
	userRepo          domainrepo.UserRepository
	midtransSvc       *payment.MidtransService
	disableTierLimits bool
}

func NewSubscriptionUseCase(
	subRepo domainrepo.SubscriptionRepository,
	userRepo domainrepo.UserRepository,
	midtransSvc *payment.MidtransService,
	disableTierLimits bool,
) domainuc.SubscriptionUseCase {
	return &subscriptionUseCase{
		subRepo:           subRepo,
		userRepo:          userRepo,
		midtransSvc:       midtransSvc,
		disableTierLimits: disableTierLimits,
	}
}

func (uc *subscriptionUseCase) GetStatus(ctx context.Context, userID uuid.UUID) (*entity.UserSubscription, error) {
	sub, err := uc.subRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		// No subscription row ever created — user has never interacted with trial
		return &entity.UserSubscription{UserID: userID, Plan: "free", Status: "free", TrialEligible: true}, nil
	}
	now := time.Now()
	if sub.Status == "trialing" && sub.TrialEndsAt != nil && now.After(*sub.TrialEndsAt) {
		sub.Status, sub.Plan = "free", "free"
		_ = uc.subRepo.Upsert(ctx, sub)
		_, _ = uc.userRepo.Update(ctx, userID, map[string]interface{}{"tier": "free"})
	}
	if sub.Status == "past_due" && sub.GracePeriodEndsAt != nil && now.After(*sub.GracePeriodEndsAt) {
		sub.Status, sub.Plan = "free", "free"
		_ = uc.subRepo.Upsert(ctx, sub)
		_, _ = uc.userRepo.Update(ctx, userID, map[string]interface{}{"tier": "free"})
	}
	return sub, nil
}

func (uc *subscriptionUseCase) CreateTrial(ctx context.Context, userID uuid.UUID) error {
	existing, err := uc.subRepo.FindByUserID(ctx, userID)
	if err != nil {
		return err
	}
	if existing != nil {
		return nil
	}
	trialEnd := time.Now().Add(time.Duration(trialDays) * 24 * time.Hour)
	if err := uc.subRepo.Upsert(ctx, &entity.UserSubscription{
		ID:          uuid.New(),
		UserID:      userID,
		Plan:        "pro",
		Period:      "monthly",
		Status:      "trialing",
		TrialEndsAt: &trialEnd,
	}); err != nil {
		return err
	}
	// Set tier=premium so TierGate and useIsProActive allow access immediately
	_, _ = uc.userRepo.Update(ctx, userID, map[string]interface{}{"tier": "premium"})
	return nil
}

func (uc *subscriptionUseCase) Cancel(ctx context.Context, userID uuid.UUID) error {
	sub, err := uc.subRepo.FindByUserID(ctx, userID)
	if err != nil {
		return err
	}
	if sub == nil {
		return ErrSubscriptionNotFound
	}
	now := time.Now()
	sub.Status, sub.CanceledAt = "canceled", &now
	if err := uc.subRepo.Upsert(ctx, sub); err != nil {
		return err
	}
	_, err = uc.userRepo.Update(ctx, userID, map[string]interface{}{"tier": "free"})
	return err
}

func (uc *subscriptionUseCase) HandleRevenueCatWebhook(ctx context.Context, payload map[string]interface{}) error {
	event, _ := payload["event"].(map[string]interface{})
	if event == nil {
		return errors.New("missing event")
	}

	eventType, _ := event["type"].(string)
	appUserID, _ := event["app_user_id"].(string)
	productID, _ := event["product_id"].(string)
	periodType, _ := event["period_type"].(string)
	expirationAtMs, _ := event["expiration_at_ms"].(float64)

	userID, err := uuid.Parse(appUserID)
	if err != nil {
		return errors.New("invalid app_user_id: " + appUserID)
	}

	now := time.Now()
	var expiration *time.Time
	if expirationAtMs > 0 {
		t := time.UnixMilli(int64(expirationAtMs))
		expiration = &t
	}

	existing, err := uc.subRepo.FindByUserID(ctx, userID)
	if err != nil {
		return err
	}
	if existing == nil {
		existing = &entity.UserSubscription{ID: uuid.New(), UserID: userID}
	}

	switch eventType {
	case "INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION":
		period := "monthly"
		if productID != "" {
			period = productID
		}
		existing.Plan = "pro"
		existing.Period = period
		existing.Status = "active"
		existing.CurrentPeriodStart = &now
		existing.CurrentPeriodEnd = expiration
		existing.CanceledAt = nil
		existing.ProductID = productID
		_, _ = uc.userRepo.Update(ctx, userID, map[string]interface{}{"tier": "premium"})

	case "TRIAL_STARTED":
		existing.Plan = "pro"
		existing.Status = "trialing"
		existing.TrialEndsAt = expiration
		existing.ProductID = productID

	case "TRIAL_CONVERTED":
		period := periodType
		if period == "" {
			period = "monthly"
		}
		existing.Plan = "pro"
		existing.Period = period
		existing.Status = "active"
		existing.CurrentPeriodStart = &now
		existing.CurrentPeriodEnd = expiration
		existing.TrialEndsAt = nil
		existing.ProductID = productID
		_, _ = uc.userRepo.Update(ctx, userID, map[string]interface{}{"tier": "premium"})

	case "CANCELLATION", "TRIAL_CANCELLED":
		existing.CanceledAt = &now
		if existing.Status == "trialing" {
			existing.Status = "free"
			existing.Plan = "free"
			_, _ = uc.userRepo.Update(ctx, userID, map[string]interface{}{"tier": "free"})
		}

	case "EXPIRATION":
		existing.Status = "free"
		existing.Plan = "free"
		_, _ = uc.userRepo.Update(ctx, userID, map[string]interface{}{"tier": "free"})

	case "BILLING_ISSUE":
		grace := now.Add(time.Duration(gracePeriodDays) * 24 * time.Hour)
		existing.Status = "past_due"
		existing.GracePeriodEndsAt = &grace

	default:
		return nil
	}

	return uc.subRepo.Upsert(ctx, existing)
}

// CreateMidtransPayment generates a Midtrans Snap token for web subscribers.
func (uc *subscriptionUseCase) CreateMidtransPayment(ctx context.Context, userID uuid.UUID, plan, period, email, name string) (*domainuc.MidtransPaymentResult, error) {
	if uc.midtransSvc == nil || !uc.midtransSvc.Enabled() {
		return nil, ErrMidtransNotConfigured
	}

	orderID := fmt.Sprintf("SAKU-%s-%d", userID.String()[:8], time.Now().UnixMilli())
	amount := payment.PlanAmount(period)

	snap, err := uc.midtransSvc.CreateSnapToken(orderID, amount, plan, period, email, name)
	if err != nil {
		return nil, fmt.Errorf("create snap token: %w", err)
	}

	existing, err := uc.subRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		existing = &entity.UserSubscription{ID: uuid.New(), UserID: userID, Plan: "free", Status: "free"}
	}
	existing.MidtransOrderID = &orderID
	existing.PendingPeriod = &period
	_ = uc.subRepo.Upsert(ctx, existing)

	return &domainuc.MidtransPaymentResult{
		SnapToken: snap.Token,
		ClientKey: uc.midtransSvc.ClientKey(),
		OrderID:   orderID,
	}, nil
}

// ConfirmMidtransPayment polls Midtrans directly for the pending order's status
// and activates Pro if the transaction has settled. Called by the frontend after
// Snap's onSuccess so the subscription updates immediately without waiting for a webhook.
func (uc *subscriptionUseCase) ConfirmMidtransPayment(ctx context.Context, userID uuid.UUID) error {
	if uc.midtransSvc == nil || !uc.midtransSvc.Enabled() {
		return ErrMidtransNotConfigured
	}

	sub, err := uc.subRepo.FindByUserID(ctx, userID)
	if err != nil {
		return err
	}
	if sub == nil || sub.MidtransOrderID == nil || *sub.MidtransOrderID == "" {
		return errors.New("no pending midtrans order")
	}

	status, err := uc.midtransSvc.GetTransactionStatus(*sub.MidtransOrderID)
	if err != nil {
		return fmt.Errorf("get transaction status: %w", err)
	}

	if status.TransactionStatus != "settlement" && status.TransactionStatus != "capture" {
		return fmt.Errorf("payment not settled (status: %s)", status.TransactionStatus)
	}
	if status.FraudStatus == "deny" {
		return errors.New("payment flagged as fraud")
	}

	// Resolve the period from the order, not the prior subscription state.
	pendingPeriod := "monthly"
	if sub.PendingPeriod != nil && *sub.PendingPeriod != "" {
		pendingPeriod = *sub.PendingPeriod
	}

	// Verify the settled amount matches the price we quoted for that period.
	paidAmount, parseErr := strconv.ParseFloat(status.GrossAmount, 64)
	if parseErr != nil || int64(paidAmount) != payment.PlanAmount(pendingPeriod) {
		return fmt.Errorf("gross amount mismatch: got %s for period %s", status.GrossAmount, pendingPeriod)
	}

	now := time.Now()
	sub.Plan = "pro"
	sub.Period = pendingPeriod
	sub.Status = "active"
	sub.CurrentPeriodStart = &now
	sub.CanceledAt = nil
	sub.PendingPeriod = nil

	if pendingPeriod != "lifetime" {
		var periodEnd time.Time
		if pendingPeriod == "annual" {
			periodEnd = now.AddDate(1, 0, 0)
		} else {
			periodEnd = now.AddDate(0, 1, 0)
		}
		sub.CurrentPeriodEnd = &periodEnd
	}

	if err := uc.subRepo.Upsert(ctx, sub); err != nil {
		return err
	}
	_, _ = uc.userRepo.Update(ctx, userID, map[string]interface{}{"tier": "premium"})
	return nil
}

// HandleMidtransWebhook processes a payment notification from Midtrans.
func (uc *subscriptionUseCase) HandleMidtransWebhook(ctx context.Context, payload domainuc.MidtransWebhookPayload) error {
	if uc.midtransSvc == nil || !uc.midtransSvc.Enabled() {
		return ErrMidtransNotConfigured
	}

	if !uc.midtransSvc.VerifySignatureKey(payload.OrderID, payload.StatusCode, payload.GrossAmount, payload.SignatureKey) {
		return errors.New("invalid midtrans signature")
	}

	if payload.TransactionStatus != "settlement" && payload.TransactionStatus != "capture" {
		return nil
	}
	if payload.FraudStatus == "deny" {
		return nil
	}

	sub, err := uc.subRepo.FindByMidtransOrderID(ctx, payload.OrderID)
	if err != nil {
		return err
	}
	if sub == nil {
		return errors.New("order not found: " + payload.OrderID)
	}

	// Resolve the period from the order, not the prior subscription state.
	pendingPeriod := "monthly"
	if sub.PendingPeriod != nil && *sub.PendingPeriod != "" {
		pendingPeriod = *sub.PendingPeriod
	}

	// Verify the webhook amount matches the price we quoted for that period.
	paidAmount, parseErr := strconv.ParseFloat(payload.GrossAmount, 64)
	if parseErr != nil || int64(paidAmount) != payment.PlanAmount(pendingPeriod) {
		return fmt.Errorf("gross amount mismatch: got %s for period %s", payload.GrossAmount, pendingPeriod)
	}

	now := time.Now()
	sub.Plan = "pro"
	sub.Period = pendingPeriod
	sub.Status = "active"
	sub.CurrentPeriodStart = &now
	sub.CanceledAt = nil
	sub.PendingPeriod = nil

	if pendingPeriod != "lifetime" {
		var periodEnd time.Time
		if pendingPeriod == "annual" {
			periodEnd = now.AddDate(1, 0, 0)
		} else {
			periodEnd = now.AddDate(0, 1, 0)
		}
		sub.CurrentPeriodEnd = &periodEnd
	}

	if err := uc.subRepo.Upsert(ctx, sub); err != nil {
		return err
	}
	_, _ = uc.userRepo.Update(ctx, sub.UserID, map[string]interface{}{"tier": "premium"})
	return nil
}

func (uc *subscriptionUseCase) IsProActive(ctx context.Context, userID uuid.UUID) bool {
	if uc.disableTierLimits {
		return true
	}
	sub, err := uc.subRepo.FindByUserID(ctx, userID)
	if err != nil || sub == nil {
		return false
	}
	now := time.Now()
	switch sub.Status {
	case "trialing":
		return sub.TrialEndsAt != nil && now.Before(*sub.TrialEndsAt)
	case "active":
		return sub.CurrentPeriodEnd == nil || now.Before(*sub.CurrentPeriodEnd)
	case "past_due":
		return sub.GracePeriodEndsAt != nil && now.Before(*sub.GracePeriodEndsAt)
	}
	return false
}
