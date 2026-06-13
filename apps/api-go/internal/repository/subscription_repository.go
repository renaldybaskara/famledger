package repository

import (
	"context"
	"errors"
	"time"

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

func (r *subscriptionRepository) Upsert(ctx context.Context, sub *entity.UserSubscription) error {
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"plan", "period", "status",
			"trial_ends_at", "current_period_start", "current_period_end",
			"canceled_at", "grace_period_ends_at", "updated_at",
		}),
	}).Create(sub).Error
}

func (r *subscriptionRepository) CreateOrder(ctx context.Context, order *entity.PaymentOrder) error {
	return r.db.WithContext(ctx).Create(order).Error
}

func (r *subscriptionRepository) FindOrderByMidtransID(ctx context.Context, midtransOrderID string) (*entity.PaymentOrder, error) {
	var order entity.PaymentOrder
	err := r.db.WithContext(ctx).Where("midtrans_order_id = ?", midtransOrderID).First(&order).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &order, err
}

func (r *subscriptionRepository) FindOrdersByUserID(ctx context.Context, userID uuid.UUID, limit int) ([]entity.PaymentOrder, error) {
	var orders []entity.PaymentOrder
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&orders).Error
	return orders, err
}

func (r *subscriptionRepository) UpdateOrderStatus(ctx context.Context, midtransOrderID string, status string, paidAt *time.Time) error {
	data := map[string]interface{}{"status": status}
	if paidAt != nil {
		data["paid_at"] = paidAt
	}
	return r.db.WithContext(ctx).
		Model(&entity.PaymentOrder{}).
		Where("midtrans_order_id = ?", midtransOrderID).
		Updates(data).Error
}
