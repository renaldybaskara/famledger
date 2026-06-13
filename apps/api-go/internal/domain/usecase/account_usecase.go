package usecase

import (
	"context"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type CreateAccountInput struct {
	Name          string
	Type          string
	BankCode      *string
	AccountNumber *string
	Balance       *float64
	Currency      *string
	Color         *string
	Icon          *string
}

type UpdateAccountInput struct {
	Name          *string
	Type          *string
	BankCode      *string
	AccountNumber *string
	Color         *string
	Icon          *string
	IsDefault     *bool
	Balance       *float64
}

type AccountUseCase interface {
	FindAll(ctx context.Context, userID uuid.UUID) ([]entity.Account, error)
	Create(ctx context.Context, userID uuid.UUID, in CreateAccountInput) (*entity.Account, error)
	Update(ctx context.Context, userID, id uuid.UUID, in UpdateAccountInput) (*entity.Account, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
}
