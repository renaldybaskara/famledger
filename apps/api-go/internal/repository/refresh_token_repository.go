package repository

import (
	"context"
	"errors"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type refreshTokenRepository struct {
	db *gorm.DB
}

func NewRefreshTokenRepository(db *gorm.DB) domainrepo.RefreshTokenRepository {
	return &refreshTokenRepository{db: db}
}

func (r *refreshTokenRepository) Save(ctx context.Context, rt *entity.RefreshToken) error {
	return r.db.WithContext(ctx).Create(rt).Error
}

func (r *refreshTokenRepository) FindValid(ctx context.Context, userID uuid.UUID, token string) (*entity.RefreshToken, error) {
	var rt entity.RefreshToken
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND token = ? AND revoked_at IS NULL AND expires_at > ?", userID, token, time.Now()).
		First(&rt).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &rt, nil
}

func (r *refreshTokenRepository) Revoke(ctx context.Context, userID uuid.UUID, token string) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&entity.RefreshToken{}).
		Where("user_id = ? AND token = ?", userID, token).
		Update("revoked_at", now).Error
}

func (r *refreshTokenRepository) RevokeAll(ctx context.Context, userID uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&entity.RefreshToken{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Update("revoked_at", now).Error
}

func (r *refreshTokenRepository) ReplaceToken(ctx context.Context, userID uuid.UUID, oldToken, newToken string, expiresAt time.Time) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		// Revoke old token
		if err := tx.Model(&entity.RefreshToken{}).
			Where("user_id = ? AND token = ?", userID, oldToken).
			Update("revoked_at", now).Error; err != nil {
			return err
		}
		// Save new token
		newRT := &entity.RefreshToken{
			ID:        uuid.New(),
			UserID:    userID,
			Token:     newToken,
			ExpiresAt: expiresAt,
		}
		return tx.Create(newRT).Error
	})
}
