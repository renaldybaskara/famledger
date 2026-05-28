package usecase

import (
	"context"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type UpdateProfileInput struct {
	Name      *string
	AvatarURL *string
}

type UserUseCase interface {
	GetProfile(ctx context.Context, userID uuid.UUID) (*entity.User, error)
	UpdateProfile(ctx context.Context, userID uuid.UUID, in UpdateProfileInput) (*entity.User, error)
}
