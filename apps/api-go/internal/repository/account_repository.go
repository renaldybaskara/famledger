package repository

import (
	"context"
	"errors"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type accountRepository struct {
	db *gorm.DB
}

func NewAccountRepository(db *gorm.DB) domainrepo.AccountRepository {
	return &accountRepository{db: db}
}

func (r *accountRepository) FindAllByUserID(ctx context.Context, userID uuid.UUID) ([]entity.Account, error) {
	var accounts []entity.Account
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND is_active = true", userID).
		Order("is_default DESC, created_at ASC").
		Find(&accounts).Error
	return accounts, err
}

func (r *accountRepository) FindByID(ctx context.Context, userID, id uuid.UUID) (*entity.Account, error) {
	var account entity.Account
	err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ? AND is_active = true", id, userID).
		First(&account).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &account, nil
}

func (r *accountRepository) Create(ctx context.Context, account *entity.Account) error {
	return r.db.WithContext(ctx).Create(account).Error
}

func (r *accountRepository) Update(ctx context.Context, userID, id uuid.UUID, data map[string]interface{}) (*entity.Account, error) {
	err := r.db.WithContext(ctx).Model(&entity.Account{}).
		Where("id = ? AND user_id = ? AND is_active = true", id, userID).
		Updates(data).Error
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, userID, id)
}

func (r *accountRepository) SoftDelete(ctx context.Context, userID, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&entity.Account{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_active", false).Error
}
