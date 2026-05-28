package repository

import (
	"context"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type BudgetRepository interface {
	FindAllByUserID(ctx context.Context, userID uuid.UUID) ([]entity.Budget, error)
	FindByID(ctx context.Context, userID, id uuid.UUID) (*entity.Budget, error)
	Create(ctx context.Context, budget *entity.Budget) error
	Update(ctx context.Context, userID, id uuid.UUID, data map[string]interface{}) (*entity.Budget, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
	FindSubscriptionsByUserID(ctx context.Context, userID uuid.UUID) ([]entity.Subscription, error)
	GetSpendingByCategory(ctx context.Context, userID uuid.UUID, start, end time.Time) (map[uuid.UUID]float64, error)
}
