package usecase

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	paymentsvc "github.com/fintrackr/api/internal/infrastructure/payment"
	"github.com/google/uuid"
)

const (
	trialDays       = 14
	gracePeriodDays = 3
	priceMonthly    = int64(49000)
	priceAnnual     = int64(490000)
)

var ErrSubscriptionNotFound = errors.New("subscription not found")

type subscriptionUseCase struct {
	subRepo           domainrepo.SubscriptionRepository
	userRepo          domainrepo.UserRepository
	midtrans          *paymentsvc.MidtransService
	disableTierLimits bool
}

func NewSubscriptionUseCase(
	subRepo domainrepo.SubscriptionRepository,
	userRepo domainrepo.UserRepository,
	midtrans *paymentsvc.MidtransService,
	disableTierLimits bool,
) domainuc.SubscriptionUseCase {
	return &subscriptionUseCase{
		subRepo:           subRepo,
		userRepo:          userRepo,
		midtrans:          midtrans,
		disableTierLimits: disableTierLimits,
	}
}

func (uc *subscriptionUseCase) GetStatus(ctx context.Context, userID uuid.UUID) (*entity.UserSubscription, error) {
	sub, err := uc.subRepo.FindByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return &entity.UserSubscription{UserID: userID, Plan: "free", Status: "free"}, nil
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
	return uc.subRepo.Upsert(ctx, &entity.UserSubscription{
		ID:          uuid.New(),
		UserID:      userID,
		Plan:        "pro",
		Period:      "monthly",
		Status:      "trialing",
		TrialEndsAt: &trialEnd,
	})
}

func (uc *subscriptionUseCase) Checkout(ctx context.Context, userID uuid.UUID, in domainuc.CheckoutInput) (*domainuc.CheckoutOutput, error) {
	if !uc.midtrans.Enabled() {
		return nil, errors.New("payment gateway not configured")
	}
	user, err := uc.userRepo.FindByID(ctx, userID)
	if err != nil || user == nil {
		return nil, ErrUserNotFound
	}

	amount := priceMonthly
	itemName := "Saku Pro — Bulanan"
	if in.Period == "annual" {
		amount = priceAnnual
		itemName = "Saku Pro — Tahunan"
	}

	orderID := fmt.Sprintf("saku-pro-%s-%d", userID.String()[:8], time.Now().UnixMilli())
	snapResp, err := uc.midtrans.CreateSnapToken(paymentsvc.SnapRequest{
		TransactionDetails: paymentsvc.TransactionDetails{OrderID: orderID, GrossAmount: amount},
		CustomerDetails:    paymentsvc.CustomerDetails{FirstName: user.Name, Email: user.Email},
		ItemDetails:        []paymentsvc.ItemDetail{{ID: "saku-pro", Price: amount, Quantity: 1, Name: itemName}},
	})
	if err != nil {
		return nil, err
	}

	if err := uc.subRepo.CreateOrder(ctx, &entity.PaymentOrder{
		ID:              uuid.New(),
		UserID:          userID,
		MidtransOrderID: orderID,
		SnapToken:       snapResp.Token,
		Plan:            "pro",
		Period:          in.Period,
		Amount:          float64(amount),
		Status:          "pending",
	}); err != nil {
		return nil, err
	}
	return &domainuc.CheckoutOutput{
		SnapToken:       snapResp.Token,
		MidtransOrderID: orderID,
		Amount:          amount,
		RedirectURL:     snapResp.RedirectURL,
	}, nil
}

func (uc *subscriptionUseCase) HandleWebhook(ctx context.Context, payload map[string]interface{}) error {
	orderID, _ := payload["order_id"].(string)
	statusCode, _ := payload["status_code"].(string)
	grossAmount, _ := payload["gross_amount"].(string)
	sigKey, _ := payload["signature_key"].(string)
	txStatus, _ := payload["transaction_status"].(string)
	fraudStatus, _ := payload["fraud_status"].(string)

	if !uc.midtrans.VerifyNotification(orderID, statusCode, grossAmount, sigKey) {
		return errors.New("invalid webhook signature")
	}
	order, err := uc.subRepo.FindOrderByMidtransID(ctx, orderID)
	if err != nil || order == nil {
		return errors.New("order not found")
	}

	var newStatus string
	var succeeded bool
	switch txStatus {
	case "capture":
		if fraudStatus == "challenge" {
			newStatus = "challenge"
		} else {
			newStatus, succeeded = "paid", true
		}
	case "settlement":
		newStatus, succeeded = "paid", true
	case "cancel", "expire":
		newStatus = txStatus
	default:
		newStatus = txStatus
	}

	now := time.Now()
	var paidAt *time.Time
	if succeeded {
		paidAt = &now
	}
	if err := uc.subRepo.UpdateOrderStatus(ctx, orderID, newStatus, paidAt); err != nil {
		return err
	}
	if !succeeded {
		return nil
	}

	periodEnd := now.AddDate(0, 1, 0)
	if order.Period == "annual" {
		periodEnd = now.AddDate(1, 0, 0)
	}
	if err := uc.subRepo.Upsert(ctx, &entity.UserSubscription{
		ID:                 uuid.New(),
		UserID:             order.UserID,
		Plan:               "pro",
		Period:             order.Period,
		Status:             "active",
		CurrentPeriodStart: &now,
		CurrentPeriodEnd:   &periodEnd,
	}); err != nil {
		return err
	}
	_, _ = uc.userRepo.Update(ctx, order.UserID, map[string]interface{}{"tier": "premium"})
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

func (uc *subscriptionUseCase) GetHistory(ctx context.Context, userID uuid.UUID) ([]entity.PaymentOrder, error) {
	return uc.subRepo.FindOrdersByUserID(ctx, userID, 20)
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
