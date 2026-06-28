package usecase

import (
	"context"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type ConnectIMAPInput struct {
	Email    string
	ImapHost string
	ImapPort int
	ImapUser string
	ImapPass string
}

type EmailIntegrationUseCase interface {
	// List all integrations for a user
	List(ctx context.Context, userID uuid.UUID) ([]entity.EmailIntegration, error)

	// Connect IMAP (generic email)
	ConnectIMAP(ctx context.Context, userID uuid.UUID, in ConnectIMAPInput) (*entity.EmailIntegration, error)

	// Get Gmail OAuth URL (returns redirect URL)
	GetGmailAuthURL(ctx context.Context, userID uuid.UUID) (string, error)

	// Complete Gmail OAuth (exchange code → store tokens)
	CompleteGmailOAuth(ctx context.Context, userID uuid.UUID, code string) (*entity.EmailIntegration, error)

	// Disconnect an integration
	Disconnect(ctx context.Context, integrationID, userID uuid.UUID) error

	// Toggle active/inactive
	SetActive(ctx context.Context, integrationID, userID uuid.UUID, active bool) error

	// Manual sync trigger — sinceDate overrides last_sync_at if provided
	Sync(ctx context.Context, integrationID, userID uuid.UUID, sinceDate *time.Time) error
}
