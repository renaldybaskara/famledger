package repository

import (
	"github.com/google/uuid"
	"github.com/fintrackr/api/internal/domain/entity"
)

type SavingsGoalRepository interface {
	// Goals CRUD
	Create(goal *entity.SavingsGoal) error
	FindByID(id uuid.UUID) (*entity.SavingsGoal, error)
	FindByUserID(userID uuid.UUID, status string) ([]entity.SavingsGoal, error)
	FindByWorkspaceID(workspaceID uuid.UUID, status string) ([]entity.SavingsGoal, error)
	Update(goal *entity.SavingsGoal) error
	Delete(id uuid.UUID) error
	UpdateStatus(id uuid.UUID, status string) error
	UpdateCurrentAmount(id uuid.UUID, amount float64) error

	// Sources
	CreateSource(source *entity.SavingsGoalSource) error
	FindSourcesByGoalID(goalID uuid.UUID) ([]entity.SavingsGoalSource, error)
	FindSourceByID(id uuid.UUID) (*entity.SavingsGoalSource, error)
	UpdateSource(source *entity.SavingsGoalSource) error
	DeleteSource(id uuid.UUID) error
	FindAutoSourcesByAccountID(accountID uuid.UUID) ([]entity.SavingsGoalSource, error)

	// Contributions
	CreateContribution(contribution *entity.SavingsGoalContribution) error
	FindContributionsByGoalID(goalID uuid.UUID, contribType string, page, limit int) ([]entity.SavingsGoalContribution, int64, error)
	FindContributionByTransactionID(transactionID uuid.UUID) (*entity.SavingsGoalContribution, error)

	// Allocations
	FindAllocationsByAccountID(accountID uuid.UUID) ([]entity.SavingsGoalAllocation, error)
	FindAllocationsByGoalID(goalID uuid.UUID) ([]entity.SavingsGoalAllocation, error)
	UpsertAllocations(allocations []entity.SavingsGoalAllocation) error

	// Summary
	GetSummary(userID uuid.UUID) (*SavingsGoalSummary, error)
	CountActiveGoals(userID uuid.UUID) (int64, error)
	CountActiveWorkspaceGoals(workspaceID uuid.UUID) (int64, error)
}

type SavingsGoalSummary struct {
	TotalGoals     int64   `json:"totalGoals"`
	OnTrack        int64   `json:"onTrack"`
	Behind         int64   `json:"behind"`
	TotalTarget    float64 `json:"totalTarget"`
	TotalCurrent   float64 `json:"totalCurrent"`
	OverallPercent float64 `json:"overallPercent"`
	// Source breakdown
	TotalSavingAccount float64 `json:"totalSavingAccount"`
	TotalStocks        float64 `json:"totalStocks"`
	TotalGold          float64 `json:"totalGold"`
	TotalReksadana     float64 `json:"totalReksadana"`
	TotalCrypto        float64 `json:"totalCrypto"`
	TotalDeposit       float64 `json:"totalDeposit"`
	TotalCash          float64 `json:"totalCash"`
	TotalOther         float64 `json:"totalOther"`
}
