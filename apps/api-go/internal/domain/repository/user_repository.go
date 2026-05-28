package repository

import (
	"context"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type UserRepository interface {
	Create(ctx context.Context, user *entity.User) error
	FindByID(ctx context.Context, id uuid.UUID) (*entity.User, error)
	FindByEmail(ctx context.Context, email string) (*entity.User, error)
	FindByGoogleID(ctx context.Context, googleID string) (*entity.User, error)
	FindByEmailVerificationToken(ctx context.Context, token string) (*entity.User, error)
	FindByPasswordResetToken(ctx context.Context, token string) (*entity.User, error)
	Update(ctx context.Context, id uuid.UUID, data map[string]interface{}) (*entity.User, error)
}
