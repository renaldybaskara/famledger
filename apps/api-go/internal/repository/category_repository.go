package repository

import (
	"context"
	"errors"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type categoryRepository struct {
	db *gorm.DB
}

func NewCategoryRepository(db *gorm.DB) domainrepo.CategoryRepository {
	return &categoryRepository{db: db}
}

// FindAllForUser returns global defaults + user-specific categories
func (r *categoryRepository) FindAllForUser(ctx context.Context, userID uuid.UUID) ([]entity.Category, error) {
	var categories []entity.Category
	err := r.db.WithContext(ctx).
		Where("(user_id IS NULL OR user_id = ?) AND is_active = true", userID).
		Order("sort_order ASC, created_at ASC").
		Find(&categories).Error
	return categories, err
}

func (r *categoryRepository) FindByID(ctx context.Context, id uuid.UUID) (*entity.Category, error) {
	var cat entity.Category
	err := r.db.WithContext(ctx).
		Where("id = ? AND is_active = true", id).
		First(&cat).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &cat, nil
}

func (r *categoryRepository) Create(ctx context.Context, category *entity.Category) error {
	return r.db.WithContext(ctx).Create(category).Error
}

func (r *categoryRepository) Update(ctx context.Context, userID, id uuid.UUID, data map[string]interface{}) (*entity.Category, error) {
	err := r.db.WithContext(ctx).Model(&entity.Category{}).
		Where("id = ? AND user_id = ? AND is_active = true", id, userID).
		Updates(data).Error
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id)
}

func (r *categoryRepository) SoftDelete(ctx context.Context, userID, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&entity.Category{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_active", false).Error
}
