package repository

import (
	"context"
	"errors"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type emailIntegrationRepository struct {
	db *gorm.DB
}

func NewEmailIntegrationRepository(db *gorm.DB) domainrepo.EmailIntegrationRepository {
	return &emailIntegrationRepository{db: db}
}

func (r *emailIntegrationRepository) Create(ctx context.Context, integration *entity.EmailIntegration) error {
	return r.db.WithContext(ctx).Create(integration).Error
}

func (r *emailIntegrationRepository) FindByID(ctx context.Context, id uuid.UUID) (*entity.EmailIntegration, error) {
	var e entity.EmailIntegration
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&e).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *emailIntegrationRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]entity.EmailIntegration, error) {
	var integrations []entity.EmailIntegration
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&integrations).Error
	return integrations, err
}

func (r *emailIntegrationRepository) FindByUserIDAndEmail(ctx context.Context, userID uuid.UUID, email string) (*entity.EmailIntegration, error) {
	var e entity.EmailIntegration
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND email = ?", userID, email).
		First(&e).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *emailIntegrationRepository) FindAnyByUserIDAndEmail(ctx context.Context, userID uuid.UUID, email string) (*entity.EmailIntegration, error) {
	var e entity.EmailIntegration
	err := r.db.WithContext(ctx).Unscoped().
		Where("user_id = ? AND email = ?", userID, email).
		First(&e).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &e, err
}

func (r *emailIntegrationRepository) FindAllActive(ctx context.Context) ([]entity.EmailIntegration, error) {
	var integrations []entity.EmailIntegration
	err := r.db.WithContext(ctx).
		Where("is_active = true").
		Order("created_at ASC").
		Find(&integrations).Error
	return integrations, err
}

func (r *emailIntegrationRepository) Update(ctx context.Context, id uuid.UUID, data map[string]interface{}) (*entity.EmailIntegration, error) {
	err := r.db.WithContext(ctx).Model(&entity.EmailIntegration{}).
		Where("id = ?", id).
		Updates(data).Error
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id)
}

func (r *emailIntegrationRepository) Restore(ctx context.Context, id uuid.UUID, data map[string]interface{}) (*entity.EmailIntegration, error) {
	err := r.db.WithContext(ctx).Unscoped().Model(&entity.EmailIntegration{}).
		Where("id = ?", id).
		Updates(data).Error
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id)
}

func (r *emailIntegrationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&entity.EmailIntegration{}).Error
}
