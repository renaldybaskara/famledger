package usecase

import (
	"context"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type CreateCategoryInput struct {
	Name      string
	NameEn    *string
	Icon      string
	Color     string
	Type      string
	SortOrder *int
}

type UpdateCategoryInput struct {
	Name      *string
	NameEn    *string
	Icon      *string
	Color     *string
	SortOrder *int
}

type CategoryUseCase interface {
	FindAll(ctx context.Context, userID uuid.UUID) ([]entity.Category, error)
	Create(ctx context.Context, userID uuid.UUID, in CreateCategoryInput) (*entity.Category, error)
	Update(ctx context.Context, userID, id uuid.UUID, in UpdateCategoryInput) (*entity.Category, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
}
