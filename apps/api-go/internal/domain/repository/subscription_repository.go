package repository

import (
	"context"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type SubscriptionRepository interface {
	FindByUserID(ctx context.Context, userID uuid.UUID) (*entity.UserSubscription, error)
	Upsert(ctx context.Context, sub *entity.UserSubscription) error
	CreateOrder(ctx context.Context, order *entity.PaymentOrder) error
	FindOrderByMidtransID(ctx context.Context, midtransOrderID string) (*entity.PaymentOrder, error)
	FindOrdersByUserID(ctx context.Context, userID uuid.UUID, limit int) ([]entity.PaymentOrder, error)
	UpdateOrderStatus(ctx context.Context, midtransOrderID string, status string, paidAt *time.Time) error
}
