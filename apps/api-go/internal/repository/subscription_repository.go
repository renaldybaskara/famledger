package repository

import (
	"context"
	"errors"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type subscriptionRepository struct {
	db *gorm.DB
}

func NewSubscriptionRepository(db *gorm.DB) domainrepo.SubscriptionRepository {
	return &subscriptionRepository{db: db}
}

func (r *subscriptionRepository) FindByUserID(ctx context.Context, userID uuid.UUID) (*entity.UserSubscription, error) {
	var sub entity.UserSubscription
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&sub).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &sub, err
}

func (r *subscriptionRepository) FindByMidtransOrderID(ctx context.Context, orderID string) (*entity.UserSubscription, error) {
	var sub entity.UserSubscription
	err := r.db.WithContext(ctx).Where("midtrans_order_id = ?", orderID).First(&sub).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &sub, err
}

func (r *subscriptionRepository) Upsert(ctx context.Context, sub *entity.UserSubscription) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"plan", "period", "status",
			"trial_ends_at", "current_period_start", "current_period_end",
			"canceled_at", "grace_period_ends_at",
			"revenue_cat_app_user_id", "product_id",
			"midtrans_order_id",
			"updated_at",
		}),
	}).Create(sub).Error
}
