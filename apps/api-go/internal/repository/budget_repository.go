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

type budgetRepository struct {
	db *gorm.DB
}

func NewBudgetRepository(db *gorm.DB) domainrepo.BudgetRepository {
	return &budgetRepository{db: db}
}

func (r *budgetRepository) FindAllByUserID(ctx context.Context, userID uuid.UUID) ([]entity.Budget, error) {
	var budgets []entity.Budget
	err := r.db.WithContext(ctx).
		Preload("Category").
		Where("user_id = ? AND is_active = true", userID).
		Order("created_at DESC").
		Find(&budgets).Error
	return budgets, err
}

func (r *budgetRepository) FindByID(ctx context.Context, userID, id uuid.UUID) (*entity.Budget, error) {
	var budget entity.Budget
	err := r.db.WithContext(ctx).
		Preload("Category").
		Where("id = ? AND user_id = ? AND is_active = true", id, userID).
		First(&budget).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &budget, nil
}

func (r *budgetRepository) Create(ctx context.Context, budget *entity.Budget) error {
	return r.db.WithContext(ctx).Create(budget).Error
}

func (r *budgetRepository) Update(ctx context.Context, userID, id uuid.UUID, data map[string]interface{}) (*entity.Budget, error) {
	err := r.db.WithContext(ctx).Model(&entity.Budget{}).
		Where("id = ? AND user_id = ? AND is_active = true", id, userID).
		Updates(data).Error
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, userID, id)
}

func (r *budgetRepository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&entity.Budget{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_active", false).Error
}

func (r *budgetRepository) FindSubscriptionsByUserID(ctx context.Context, userID uuid.UUID) ([]entity.Subscription, error) {
	var subs []entity.Subscription
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND is_active = true", userID).
		Order("next_billing_date ASC").
		Find(&subs).Error
	return subs, err
}

type spendingRow struct {
	CategoryID *uuid.UUID
	Total      float64
}

func (r *budgetRepository) GetSpendingByCategory(ctx context.Context, userID uuid.UUID, start, end time.Time) (map[uuid.UUID]float64, error) {
	var rows []spendingRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT category_id, COALESCE(SUM(amount), 0) AS total
		FROM transactions
		WHERE user_id = ? AND type = 'expense' AND deleted_at IS NULL AND date BETWEEN ? AND ?
		GROUP BY category_id
	`, userID, start, end).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	result := make(map[uuid.UUID]float64)
	for _, row := range rows {
		if row.CategoryID != nil {
			result[*row.CategoryID] = row.Total
		}
	}
	return result, nil
}
