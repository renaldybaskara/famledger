package usecase

import (
	"context"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type CreateBudgetInput struct {
	Name       string
	Amount     float64
	CategoryID *uuid.UUID
	Period     string
	StartDate  time.Time
	EndDate    *time.Time
	CarryOver  *bool
	AlertAt80  *bool
	AlertAt100 *bool
	AlertAt120 *bool
}

type UpdateBudgetInput struct {
	Name       *string
	Amount     *float64
	CategoryID *uuid.UUID
	Period     *string
	StartDate  *time.Time
	EndDate    *time.Time
}

type BudgetWithStats struct {
	entity.Budget
	Spent      float64 `json:"spent"`
	Remaining  float64 `json:"remaining"`
	Percentage float64 `json:"percentage"`
	Status     string  `json:"status"` // ok|warning|over|critical
}

type BudgetUseCase interface {
	FindAll(ctx context.Context, userID uuid.UUID) ([]BudgetWithStats, error)
	Create(ctx context.Context, userID uuid.UUID, in CreateBudgetInput) (*entity.Budget, error)
	Update(ctx context.Context, userID, id uuid.UUID, in UpdateBudgetInput) (*entity.Budget, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
	FindSubscriptions(ctx context.Context, userID uuid.UUID) ([]entity.Subscription, error)
}
