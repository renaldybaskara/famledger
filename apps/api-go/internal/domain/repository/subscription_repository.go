package repository

import (
	"context"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type SubscriptionRepository interface {
	FindByUserID(ctx context.Context, userID uuid.UUID) (*entity.UserSubscription, error)
	FindByMidtransOrderID(ctx context.Context, orderID string) (*entity.UserSubscription, error)
	Upsert(ctx context.Context, sub *entity.UserSubscription) error
}
