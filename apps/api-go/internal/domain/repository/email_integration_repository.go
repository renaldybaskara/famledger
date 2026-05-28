package repository

import (
	"context"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type EmailIntegrationRepository interface {
	Create(ctx context.Context, integration *entity.EmailIntegration) error
	FindByID(ctx context.Context, id uuid.UUID) (*entity.EmailIntegration, error)
	FindByUserID(ctx context.Context, userID uuid.UUID) ([]entity.EmailIntegration, error)
	FindByUserIDAndEmail(ctx context.Context, userID uuid.UUID, email string) (*entity.EmailIntegration, error)
	// FindAllActive returns every active integration (used by background workers on startup).
	FindAllActive(ctx context.Context) ([]entity.EmailIntegration, error)
	Update(ctx context.Context, id uuid.UUID, data map[string]interface{}) (*entity.EmailIntegration, error)
	Delete(ctx context.Context, id uuid.UUID) error
}
