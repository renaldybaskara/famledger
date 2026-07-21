package usecase

import (
	"time"

	"github.com/google/uuid"
	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/fintrackr/api/internal/domain/repository"
)

type SavingsGoalUsecase interface {
	// Goals CRUD
	CreateGoal(input CreateGoalInput) (*entity.SavingsGoal, error)
	GetGoal(id uuid.UUID, userID uuid.UUID) (*entity.SavingsGoal, error)
	ListGoals(userID uuid.UUID, status string) ([]entity.SavingsGoal, error)
	ListWorkspaceGoals(workspaceID uuid.UUID, status string) ([]entity.SavingsGoal, error)
	UpdateGoal(id uuid.UUID, userID uuid.UUID, input UpdateGoalInput) (*entity.SavingsGoal, error)
	DeleteGoal(id uuid.UUID, userID uuid.UUID) error
	UpdateGoalStatus(id uuid.UUID, userID uuid.UUID, status string) error

	// Sources
	AddSource(goalID uuid.UUID, userID uuid.UUID, input AddSourceInput) (*entity.SavingsGoalSource, error)
	UpdateSource(sourceID uuid.UUID, userID uuid.UUID, input UpdateSourceInput) (*entity.SavingsGoalSource, error)
	DeleteSource(sourceID uuid.UUID, userID uuid.UUID) error
	ListSources(goalID uuid.UUID) ([]entity.SavingsGoalSource, error)

	// Contributions
	AddContribution(goalID uuid.UUID, userID uuid.UUID, input AddContributionInput) (*entity.SavingsGoalContribution, error)
	ListContributions(goalID uuid.UUID, contribType string, page, limit int) ([]entity.SavingsGoalContribution, int64, error)

	// Auto-tracking (called from EmailImportService)
	ProcessIncomingTransaction(tx entity.Transaction) error

	// Allocations
	GetAllocations(userID uuid.UUID) ([]entity.SavingsGoalAllocation, error)
	SetAllocations(userID uuid.UUID, input []SetAllocationInput) error

	// Summary
	GetSummary(userID uuid.UUID) (*repository.SavingsGoalSummary, error)
}

// Input DTOs

type CreateGoalInput struct {
	UserID       uuid.UUID   `json:"-"`
	WorkspaceID  *uuid.UUID  `json:"workspaceId,omitempty"`
	Name         string      `json:"name" binding:"required"`
	Description  *string     `json:"description,omitempty"`
	TargetAmount float64     `json:"targetAmount" binding:"required,min=10000"`
	Currency     string      `json:"currency,omitempty"`
	Icon         string      `json:"icon,omitempty"`
	Color        string      `json:"color,omitempty"`
	Deadline     *time.Time  `json:"deadline,omitempty"`
	Sources      []AddSourceInput `json:"sources,omitempty"`
}

type UpdateGoalInput struct {
	Name         *string    `json:"name,omitempty"`
	Description  *string    `json:"description,omitempty"`
	TargetAmount *float64   `json:"targetAmount,omitempty"`
	Icon         *string    `json:"icon,omitempty"`
	Color        *string    `json:"color,omitempty"`
	Deadline     *time.Time `json:"deadline,omitempty"`
}

type AddSourceInput struct {
	SourceType   string     `json:"sourceType" binding:"required"` // saving_account|stocks|gold|crypto|reksadana|deposit|cash|other
	SourceName   string     `json:"sourceName" binding:"required"`
	TrackingMode string     `json:"trackingMode,omitempty"` // auto|manual (only saving_account can be auto)
	AccountID    *uuid.UUID `json:"accountId,omitempty"`    // only for saving_account with auto
}

type UpdateSourceInput struct {
	SourceName   *string    `json:"sourceName,omitempty"`
	TrackingMode *string    `json:"trackingMode,omitempty"`
	AccountID    *uuid.UUID `json:"accountId,omitempty"`
}

type AddContributionInput struct {
	SourceID      uuid.UUID  `json:"sourceId" binding:"required"`
	Amount        float64    `json:"amount" binding:"required"`
	Type          string     `json:"type" binding:"required"` // manual|withdraw
	Note          *string    `json:"note,omitempty"`
	ContributedAt *time.Time `json:"contributedAt,omitempty"`
}

type SetAllocationInput struct {
	AccountID  uuid.UUID `json:"accountId" binding:"required"`
	GoalID     uuid.UUID `json:"goalId" binding:"required"`
	SourceID   uuid.UUID `json:"sourceId" binding:"required"`
	Percentage float64   `json:"percentage" binding:"required,min=0,max=100"`
}
