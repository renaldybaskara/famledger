package repository

import (
	"context"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type AccountRepository interface {
	FindAllByUserID(ctx context.Context, userID uuid.UUID) ([]entity.Account, error)
	FindByID(ctx context.Context, userID, id uuid.UUID) (*entity.Account, error)
	Create(ctx context.Context, account *entity.Account) error
	Update(ctx context.Context, userID, id uuid.UUID, data map[string]interface{}) (*entity.Account, error)
	SoftDelete(ctx context.Context, userID, id uuid.UUID) error
}
