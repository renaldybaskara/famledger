package repository

import (
	"context"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type CategoryRepository interface {
	FindAllForUser(ctx context.Context, userID uuid.UUID) ([]entity.Category, error)
	FindByID(ctx context.Context, id uuid.UUID) (*entity.Category, error)
	Create(ctx context.Context, category *entity.Category) error
	Update(ctx context.Context, userID, id uuid.UUID, data map[string]interface{}) (*entity.Category, error)
	SoftDelete(ctx context.Context, userID, id uuid.UUID) error
}
