package repository

import (
	"context"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

// ListEmailMessagesQuery holds filter/pagination options for querying email messages.
type ListEmailMessagesQuery struct {
	IntegrationID *uuid.UUID
	ParseStatus   string // pending|parsed|skipped|failed — empty means all
	AIUsed        *bool  // nil = no filter, true = only AI-processed messages
	Page          int
	Limit         int
}

// EmailMessageRepository defines persistence operations for EmailMessage.
type EmailMessageRepository interface {
	// Create inserts a new email message.
	Create(ctx context.Context, msg *entity.EmailMessage) error

	// CreateBatch inserts multiple messages, ignoring duplicates (ON CONFLICT DO NOTHING on MessageID).
	CreateBatch(ctx context.Context, msgs []entity.EmailMessage) error

	// FindByID returns one email message by primary key (must belong to userID).
	FindByID(ctx context.Context, userID, id uuid.UUID) (*entity.EmailMessage, error)

	// FindByMessageID checks whether a raw email ID already exists (idempotency guard).
	FindByMessageID(ctx context.Context, userID uuid.UUID, messageID string) (*entity.EmailMessage, error)

	// ListByUser returns paged email messages for a user.
	ListByUser(ctx context.Context, userID uuid.UUID, q ListEmailMessagesQuery) ([]entity.EmailMessage, int64, error)

	// UpdateStatus updates the parse/import fields after processing.
	UpdateStatus(ctx context.Context, id uuid.UUID, data map[string]interface{}) error

	// CountPendingByIntegration returns how many messages are still pending for a given integration.
	CountPendingByIntegration(ctx context.Context, integrationID uuid.UUID) (int64, error)

	// FindPendingBatch returns up to `limit` pending messages for re-processing.
	FindPendingBatch(ctx context.Context, integrationID uuid.UUID, limit int) ([]entity.EmailMessage, error)

	// FindByIntegrationSince returns all messages received after `since` for dedup on re-scan.
	FindMessageIDsSince(ctx context.Context, integrationID uuid.UUID, since time.Time) (map[string]bool, error)
}
