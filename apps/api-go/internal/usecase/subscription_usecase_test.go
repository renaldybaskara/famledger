package usecase

import (
	"context"
	"testing"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/google/uuid"
)

// ─── Mocks ───────────────────────────────────────────────────────────────────

type mockSubRepo struct {
	sub          *entity.UserSubscription
	upsertCalled bool
}

func (m *mockSubRepo) FindByUserID(_ context.Context, _ uuid.UUID) (*entity.UserSubscription, error) {
	return m.sub, nil
}
func (m *mockSubRepo) FindByMidtransOrderID(_ context.Context, _ string) (*entity.UserSubscription, error) {
	return nil, nil
}
func (m *mockSubRepo) Upsert(_ context.Context, sub *entity.UserSubscription) error {
	m.sub = sub
	m.upsertCalled = true
	return nil
}

type mockUserRepoMin struct{}

func (m *mockUserRepoMin) FindByID(_ context.Context, _ uuid.UUID) (*entity.User, error) {
	return &entity.User{ID: uuid.New(), Email: "test@example.com", Name: "Test"}, nil
}
func (m *mockUserRepoMin) FindByEmail(_ context.Context, _ string) (*entity.User, error)    { return nil, nil }
func (m *mockUserRepoMin) FindByGoogleID(_ context.Context, _ string) (*entity.User, error) { return nil, nil }
func (m *mockUserRepoMin) FindByEmailVerificationToken(_ context.Context, _ string) (*entity.User, error) {
	return nil, nil
}
func (m *mockUserRepoMin) FindByPasswordResetToken(_ context.Context, _ string) (*entity.User, error) {
	return nil, nil
}
func (m *mockUserRepoMin) Create(_ context.Context, _ *entity.User) error { return nil }
func (m *mockUserRepoMin) Update(_ context.Context, _ uuid.UUID, _ map[string]interface{}) (*entity.User, error) {
	return &entity.User{}, nil
}
func (m *mockUserRepoMin) Delete(_ context.Context, _ uuid.UUID) error { return nil }

var _ domainrepo.UserRepository = (*mockUserRepoMin)(nil)

func newTestSubUC(repo *mockSubRepo, disableTierLimits bool) *subscriptionUseCase {
	return &subscriptionUseCase{
		subRepo:           repo,
		userRepo:          &mockUserRepoMin{},
		disableTierLimits: disableTierLimits,
	}
}

// ─── CreateTrial ─────────────────────────────────────────────────────────────

func TestCreateTrial_NewUser(t *testing.T) {
	repo := &mockSubRepo{sub: nil}
	uc := newTestSubUC(repo, false)

	if err := uc.CreateTrial(context.Background(), uuid.New()); err != nil {
		t.Fatalf("CreateTrial failed: %v", err)
	}
	if !repo.upsertCalled {
		t.Error("expected Upsert to be called for new user")
	}
	if repo.sub.Status != "trialing" {
		t.Errorf("Status=%q, want trialing", repo.sub.Status)
	}
	if repo.sub.Plan != "pro" {
		t.Errorf("Plan=%q, want pro", repo.sub.Plan)
	}
	if repo.sub.TrialEndsAt == nil {
		t.Fatal("TrialEndsAt must not be nil")
	}
	expected := time.Now().Add(14 * 24 * time.Hour)
	diff := repo.sub.TrialEndsAt.Sub(expected)
	if diff < -5*time.Second || diff > 5*time.Second {
		t.Errorf("TrialEndsAt is not ~14 days from now: diff=%v", diff)
	}
}

func TestCreateTrial_Idempotent(t *testing.T) {
	repo := &mockSubRepo{sub: &entity.UserSubscription{Status: "active", Plan: "pro"}}
	uc := newTestSubUC(repo, false)

	if err := uc.CreateTrial(context.Background(), uuid.New()); err != nil {
		t.Fatalf("CreateTrial failed: %v", err)
	}
	if repo.upsertCalled {
		t.Error("Upsert must NOT be called when subscription already exists")
	}
}

// ─── IsProActive ─────────────────────────────────────────────────────────────

func TestIsProActive(t *testing.T) {
	future := time.Now().Add(10 * 24 * time.Hour)
	past := time.Now().Add(-1 * time.Hour)
	graceFuture := time.Now().Add(2 * 24 * time.Hour)

	tests := []struct {
		name string
		sub  *entity.UserSubscription
		want bool
	}{
		{"trialing within window", &entity.UserSubscription{Status: "trialing", TrialEndsAt: &future}, true},
		{"trialing expired", &entity.UserSubscription{Status: "trialing", TrialEndsAt: &past}, false},
		{"active within period", &entity.UserSubscription{Status: "active", CurrentPeriodEnd: &future}, true},
		{"active no period end", &entity.UserSubscription{Status: "active"}, true},
		{"active period expired", &entity.UserSubscription{Status: "active", CurrentPeriodEnd: &past}, false},
		{"past_due within grace", &entity.UserSubscription{Status: "past_due", GracePeriodEndsAt: &graceFuture}, true},
		{"past_due grace expired", &entity.UserSubscription{Status: "past_due", GracePeriodEndsAt: &past}, false},
		{"free", &entity.UserSubscription{Status: "free"}, false},
		{"canceled", &entity.UserSubscription{Status: "canceled"}, false},
		{"nil subscription", nil, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			repo := &mockSubRepo{sub: tc.sub}
			uc := newTestSubUC(repo, false)
			if got := uc.IsProActive(context.Background(), uuid.New()); got != tc.want {
				t.Errorf("IsProActive=%v, want %v", got, tc.want)
			}
		})
	}
}

func TestIsProActive_DisableTierLimits(t *testing.T) {
	repo := &mockSubRepo{sub: nil}
	uc := newTestSubUC(repo, true)
	if !uc.IsProActive(context.Background(), uuid.New()) {
		t.Error("expected true when disableTierLimits=true regardless of subscription")
	}
}

// ─── GetStatus expiry ─────────────────────────────────────────────────────────

func TestGetStatus_ExpiredTrialDowngradesImmediately(t *testing.T) {
	past := time.Now().Add(-1 * time.Hour)
	repo := &mockSubRepo{sub: &entity.UserSubscription{
		Status: "trialing", Plan: "pro", TrialEndsAt: &past,
	}}
	uc := newTestSubUC(repo, false)

	sub, err := uc.GetStatus(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetStatus error: %v", err)
	}
	if sub.Status != "free" || sub.Plan != "free" {
		t.Errorf("got status=%q plan=%q; want free/free after trial expiry", sub.Status, sub.Plan)
	}
}

func TestGetStatus_NoSubscription_ReturnsFree(t *testing.T) {
	sub, err := newTestSubUC(&mockSubRepo{}, false).GetStatus(context.Background(), uuid.New())
	if err != nil {
		t.Fatalf("GetStatus error: %v", err)
	}
	if sub.Status != "free" {
		t.Errorf("Status=%q, want free for user with no subscription", sub.Status)
	}
}

// ─── Cancel ──────────────────────────────────────────────────────────────────

func TestCancel_ActiveSub(t *testing.T) {
	future := time.Now().Add(30 * 24 * time.Hour)
	repo := &mockSubRepo{sub: &entity.UserSubscription{
		Status: "active", Plan: "pro", CurrentPeriodEnd: &future,
	}}
	if err := newTestSubUC(repo, false).Cancel(context.Background(), uuid.New()); err != nil {
		t.Fatalf("Cancel error: %v", err)
	}
	if repo.sub.Status != "canceled" {
		t.Errorf("Status=%q, want canceled", repo.sub.Status)
	}
	if repo.sub.CanceledAt == nil {
		t.Error("CanceledAt must be set after cancel")
	}
}

func TestCancel_NoSubscription(t *testing.T) {
	err := newTestSubUC(&mockSubRepo{sub: nil}, false).Cancel(context.Background(), uuid.New())
	if err != ErrSubscriptionNotFound {
		t.Errorf("expected ErrSubscriptionNotFound, got %v", err)
	}
}

// ─── HandleRevenueCatWebhook ─────────────────────────────────────────────────

func TestHandleRevenueCatWebhook_InitialPurchase(t *testing.T) {
	userID := uuid.New()
	expiryMs := float64(time.Now().Add(30*24*time.Hour).UnixMilli())
	repo := &mockSubRepo{}
	uc := newTestSubUC(repo, false)

	err := uc.HandleRevenueCatWebhook(context.Background(), map[string]interface{}{
		"event": map[string]interface{}{
			"type":               "INITIAL_PURCHASE",
			"app_user_id":        userID.String(),
			"product_id":         "monthly",
			"period_type":        "NORMAL",
			"expiration_at_ms":   expiryMs,
		},
	})
	if err != nil {
		t.Fatalf("webhook error: %v", err)
	}
	if !repo.upsertCalled {
		t.Error("expected Upsert to be called")
	}
	if repo.sub.Status != "active" {
		t.Errorf("Status=%q, want active", repo.sub.Status)
	}
}

func TestHandleRevenueCatWebhook_Expiration(t *testing.T) {
	userID := uuid.New()
	future := time.Now().Add(30 * 24 * time.Hour)
	repo := &mockSubRepo{sub: &entity.UserSubscription{
		UserID: userID, Status: "active", Plan: "pro", CurrentPeriodEnd: &future,
	}}
	uc := newTestSubUC(repo, false)

	err := uc.HandleRevenueCatWebhook(context.Background(), map[string]interface{}{
		"event": map[string]interface{}{
			"type":        "EXPIRATION",
			"app_user_id": userID.String(),
			"product_id":  "monthly",
		},
	})
	if err != nil {
		t.Fatalf("webhook error: %v", err)
	}
	if repo.sub.Status != "free" {
		t.Errorf("Status=%q, want free after expiration", repo.sub.Status)
	}
}

func TestHandleRevenueCatWebhook_InvalidUserID(t *testing.T) {
	uc := newTestSubUC(&mockSubRepo{}, false)
	err := uc.HandleRevenueCatWebhook(context.Background(), map[string]interface{}{
		"event": map[string]interface{}{
			"type":        "INITIAL_PURCHASE",
			"app_user_id": "not-a-uuid",
		},
	})
	if err == nil {
		t.Error("expected error for invalid app_user_id")
	}
}
