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

type emailMessageRepository struct {
	db *gorm.DB
}

// NewEmailMessageRepository returns a GORM-backed EmailMessageRepository.
func NewEmailMessageRepository(db *gorm.DB) domainrepo.EmailMessageRepository {
	return &emailMessageRepository{db: db}
}

func (r *emailMessageRepository) Create(ctx context.Context, msg *entity.EmailMessage) error {
	return r.db.WithContext(ctx).Create(msg).Error
}

// CreateBatch inserts a slice of messages and silently ignores duplicates based on the
// (message_id) unique index — safe to call on every polling cycle.
func (r *emailMessageRepository) CreateBatch(ctx context.Context, msgs []entity.EmailMessage) error {
	if len(msgs) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "message_id"}},
			DoNothing: true,
		}).
		CreateInBatches(msgs, 50).Error
}

func (r *emailMessageRepository) FindByID(ctx context.Context, userID, id uuid.UUID) (*entity.EmailMessage, error) {
	var msg entity.EmailMessage
	err := r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		First(&msg).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &msg, nil
}

func (r *emailMessageRepository) FindByMessageID(ctx context.Context, userID uuid.UUID, messageID string) (*entity.EmailMessage, error) {
	var msg entity.EmailMessage
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND message_id = ?", userID, messageID).
		First(&msg).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &msg, nil
}

func (r *emailMessageRepository) ListByUser(ctx context.Context, userID uuid.UUID, q domainrepo.ListEmailMessagesQuery) ([]entity.EmailMessage, int64, error) {
	db := r.db.WithContext(ctx).Model(&entity.EmailMessage{}).
		Where("user_id = ?", userID)

	if q.IntegrationID != nil {
		db = db.Where("email_integration_id = ?", q.IntegrationID)
	}
	if q.ParseStatus != "" {
		db = db.Where("parse_status = ?", q.ParseStatus)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page := q.Page
	if page < 1 {
		page = 1
	}
	limit := q.Limit
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var msgs []entity.EmailMessage
	err := db.Order("received_at DESC").Limit(limit).Offset(offset).Find(&msgs).Error
	return msgs, total, err
}

func (r *emailMessageRepository) UpdateStatus(ctx context.Context, id uuid.UUID, data map[string]interface{}) error {
	return r.db.WithContext(ctx).
		Model(&entity.EmailMessage{}).
		Where("id = ?", id).
		Updates(data).Error
}

func (r *emailMessageRepository) CountPendingByIntegration(ctx context.Context, integrationID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&entity.EmailMessage{}).
		Where("email_integration_id = ? AND parse_status = 'pending'", integrationID).
		Count(&count).Error
	return count, err
}

func (r *emailMessageRepository) FindPendingBatch(ctx context.Context, integrationID uuid.UUID, limit int) ([]entity.EmailMessage, error) {
	var msgs []entity.EmailMessage
	err := r.db.WithContext(ctx).
		Where("email_integration_id = ? AND parse_status = 'pending'", integrationID).
		Order("received_at ASC").
		Limit(limit).
		Find(&msgs).Error
	return msgs, err
}

func (r *emailMessageRepository) FindMessageIDsSince(ctx context.Context, integrationID uuid.UUID, since time.Time) (map[string]bool, error) {
	var ids []string
	err := r.db.WithContext(ctx).
		Model(&entity.EmailMessage{}).
		Select("message_id").
		Where("email_integration_id = ? AND received_at >= ?", integrationID, since).
		Pluck("message_id", &ids).Error
	if err != nil {
		return nil, err
	}
	m := make(map[string]bool, len(ids))
	for _, id := range ids {
		m[id] = true
	}
	return m, nil
}
