package repository

import (
	"context"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type RefreshTokenRepository interface {
	Save(ctx context.Context, rt *entity.RefreshToken) error
	FindValid(ctx context.Context, userID uuid.UUID, token string) (*entity.RefreshToken, error)
	Revoke(ctx context.Context, userID uuid.UUID, token string) error
	RevokeAll(ctx context.Context, userID uuid.UUID) error
	ReplaceToken(ctx context.Context, userID uuid.UUID, oldToken, newToken string, expiresAt time.Time) error
	// DeleteExpired hard-deletes rows where expires_at < now.
	// Revoked tokens are kept until natural expiry to guard against token-reuse attacks.
	DeleteExpired(ctx context.Context) (int64, error)
}
