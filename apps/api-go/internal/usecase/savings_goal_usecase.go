package usecase

import (
	"errors"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainRepo "github.com/fintrackr/api/internal/domain/repository"
	domainUsecase "github.com/fintrackr/api/internal/domain/usecase"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type savingsGoalUsecase struct {
	repo domainRepo.SavingsGoalRepository
}

func NewSavingsGoalUsecase(repo domainRepo.SavingsGoalRepository) domainUsecase.SavingsGoalUsecase {
	return &savingsGoalUsecase{repo: repo}
}

// --- Goals CRUD ---

func (u *savingsGoalUsecase) CreateGoal(input domainUsecase.CreateGoalInput) (*entity.SavingsGoal, error) {
	// Validate: max 20 active goals per user
	count, err := u.repo.CountActiveGoals(input.UserID)
	if err != nil {
		return nil, err
	}
	if count >= 20 {
		return nil, errors.New("maximum 20 active goals per user")
	}

	// Validate workspace limit
	if input.WorkspaceID != nil {
		wsCount, err := u.repo.CountActiveWorkspaceGoals(*input.WorkspaceID)
		if err != nil {
			return nil, err
		}
		if wsCount >= 10 {
			return nil, errors.New("maximum 10 active goals per workspace")
		}
	}

	// Validate target amount
	if input.TargetAmount < 10000 {
		return nil, errors.New("target amount minimum Rp 10.000")
	}

	// Set defaults
	icon := "🎯"
	if input.Icon != "" {
		icon = input.Icon
	}
	color := "#6B8E6B"
	if input.Color != "" {
		color = input.Color
	}
	currency := "IDR"
	if input.Currency != "" {
		currency = input.Currency
	}

	goal := &entity.SavingsGoal{
		UserID:       input.UserID,
		WorkspaceID:  input.WorkspaceID,
		Name:         input.Name,
		Description:  input.Description,
		TargetAmount: input.TargetAmount,
		Currency:     currency,
		Icon:         icon,
		Color:        color,
		Deadline:     input.Deadline,
		Status:       "active",
	}

	if err := u.repo.Create(goal); err != nil {
		return nil, err
	}

	// Create sources if provided
	for _, srcInput := range input.Sources {
		source := &entity.SavingsGoalSource{
			GoalID:       goal.ID,
			SourceType:   srcInput.SourceType,
			SourceName:   srcInput.SourceName,
			TrackingMode: u.resolveTrackingMode(srcInput.SourceType, srcInput.TrackingMode),
			AccountID:    srcInput.AccountID,
		}
		if err := u.repo.CreateSource(source); err != nil {
			return nil, err
		}
	}

	// Reload with sources
	return u.repo.FindByID(goal.ID)
}

func (u *savingsGoalUsecase) GetGoal(id uuid.UUID, userID uuid.UUID) (*entity.SavingsGoal, error) {
	return u.repo.FindByID(id)
}

func (u *savingsGoalUsecase) ListGoals(userID uuid.UUID, status string) ([]entity.SavingsGoal, error) {
	return u.repo.FindByUserID(userID, status)
}

func (u *savingsGoalUsecase) ListWorkspaceGoals(workspaceID uuid.UUID, status string) ([]entity.SavingsGoal, error) {
	return u.repo.FindByWorkspaceID(workspaceID, status)
}

func (u *savingsGoalUsecase) UpdateGoal(id uuid.UUID, userID uuid.UUID, input domainUsecase.UpdateGoalInput) (*entity.SavingsGoal, error) {
	goal, err := u.repo.FindByID(id)
	if err != nil {
		return nil, err
	}

	if input.Name != nil {
		goal.Name = *input.Name
	}
	if input.Description != nil {
		goal.Description = input.Description
	}
	if input.TargetAmount != nil {
		if *input.TargetAmount < 10000 {
			return nil, errors.New("target amount minimum Rp 10.000")
		}
		goal.TargetAmount = *input.TargetAmount
	}
	if input.Icon != nil {
		goal.Icon = *input.Icon
	}
	if input.Color != nil {
		goal.Color = *input.Color
	}
	if input.Deadline != nil {
		goal.Deadline = input.Deadline
	}

	if err := u.repo.Update(goal); err != nil {
		return nil, err
	}

	return u.repo.FindByID(id)
}

func (u *savingsGoalUsecase) DeleteGoal(id uuid.UUID, userID uuid.UUID) error {
	return u.repo.Delete(id)
}

func (u *savingsGoalUsecase) UpdateGoalStatus(id uuid.UUID, userID uuid.UUID, status string) error {
	validStatuses := map[string]bool{"active": true, "paused": true, "cancelled": true, "achieved": true}
	if !validStatuses[status] {
		return errors.New("invalid status")
	}

	goal, err := u.repo.FindByID(id)
	if err != nil {
		return err
	}

	// Validate status transitions (BR-2)
	validTransitions := map[string][]string{
		"active":    {"achieved", "paused", "cancelled"},
		"paused":    {"active"},
		"achieved":  {"active"},
		"cancelled": {"active"},
	}

	allowed := false
	for _, s := range validTransitions[goal.Status] {
		if s == status {
			allowed = true
			break
		}
	}
	if !allowed {
		return errors.New("invalid status transition")
	}

	if status == "achieved" {
		now := time.Now()
		goal.AchievedAt = &now
		goal.Status = status
		return u.repo.Update(goal)
	}

	return u.repo.UpdateStatus(id, status)
}

// --- Sources ---

func (u *savingsGoalUsecase) AddSource(goalID uuid.UUID, userID uuid.UUID, input domainUsecase.AddSourceInput) (*entity.SavingsGoalSource, error) {
	source := &entity.SavingsGoalSource{
		GoalID:       goalID,
		SourceType:   input.SourceType,
		SourceName:   input.SourceName,
		TrackingMode: u.resolveTrackingMode(input.SourceType, input.TrackingMode),
		AccountID:    input.AccountID,
	}

	if err := u.repo.CreateSource(source); err != nil {
		return nil, err
	}
	return source, nil
}

func (u *savingsGoalUsecase) UpdateSource(sourceID uuid.UUID, userID uuid.UUID, input domainUsecase.UpdateSourceInput) (*entity.SavingsGoalSource, error) {
	source, err := u.repo.FindSourceByID(sourceID)
	if err != nil {
		return nil, err
	}

	if input.SourceName != nil {
		source.SourceName = *input.SourceName
	}
	if input.TrackingMode != nil {
		source.TrackingMode = u.resolveTrackingMode(source.SourceType, *input.TrackingMode)
	}
	if input.AccountID != nil {
		source.AccountID = input.AccountID
	}

	if err := u.repo.UpdateSource(source); err != nil {
		return nil, err
	}
	return source, nil
}

func (u *savingsGoalUsecase) DeleteSource(sourceID uuid.UUID, userID uuid.UUID) error {
	return u.repo.DeleteSource(sourceID)
}

func (u *savingsGoalUsecase) ListSources(goalID uuid.UUID) ([]entity.SavingsGoalSource, error) {
	return u.repo.FindSourcesByGoalID(goalID)
}

// --- Contributions ---

func (u *savingsGoalUsecase) AddContribution(goalID uuid.UUID, userID uuid.UUID, input domainUsecase.AddContributionInput) (*entity.SavingsGoalContribution, error) {
	goal, err := u.repo.FindByID(goalID)
	if err != nil {
		return nil, err
	}

	// Validate: goal must be active
	if goal.Status != "active" {
		return nil, errors.New("can only contribute to active goals")
	}

	// Validate: withdraw cannot exceed current amount
	if input.Type == "withdraw" && input.Amount > 0 {
		input.Amount = -input.Amount // ensure negative
	}
	if input.Type == "withdraw" && (goal.CurrentAmount+input.Amount) < 0 {
		return nil, errors.New("withdraw amount exceeds current savings")
	}

	contributedAt := time.Now()
	if input.ContributedAt != nil {
		contributedAt = *input.ContributedAt
	}

	contribution := &entity.SavingsGoalContribution{
		GoalID:        goalID,
		SourceID:      input.SourceID,
		UserID:        userID,
		Amount:        input.Amount,
		Type:          input.Type,
		Note:          input.Note,
		ContributedAt: contributedAt,
	}

	if err := u.repo.CreateContribution(contribution); err != nil {
		return nil, err
	}

	// Update goal current amount
	if err := u.repo.UpdateCurrentAmount(goalID, input.Amount); err != nil {
		return nil, err
	}

	// Update source current amount
	source, _ := u.repo.FindSourceByID(input.SourceID)
	if source != nil {
		source.CurrentAmount += input.Amount
		u.repo.UpdateSource(source)
	}

	// Check if goal achieved
	updatedGoal, _ := u.repo.FindByID(goalID)
	if updatedGoal != nil && updatedGoal.CurrentAmount >= updatedGoal.TargetAmount {
		u.UpdateGoalStatus(goalID, userID, "achieved")
	}

	return contribution, nil
}

func (u *savingsGoalUsecase) ListContributions(goalID uuid.UUID, contribType string, page, limit int) ([]entity.SavingsGoalContribution, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	return u.repo.FindContributionsByGoalID(goalID, contribType, page, limit)
}

// --- Auto-tracking (BR-1) ---
// Called from EmailImportService when a new income transaction is created

func (u *savingsGoalUsecase) ProcessIncomingTransaction(tx entity.Transaction) error {
	if tx.AccountID == nil {
		return nil
	}
	if tx.Type != "income" && tx.Type != "transfer" {
		return nil
	}

	// Find all auto-tracking sources linked to this account
	sources, err := u.repo.FindAutoSourcesByAccountID(*tx.AccountID)
	if err != nil {
		return err
	}

	if len(sources) == 0 {
		return nil
	}

	// Check anti-double count: if this transaction already has a contribution, skip
	existing, _ := u.repo.FindContributionByTransactionID(tx.ID)
	if existing != nil {
		return nil // already processed
	}

	// Get allocations for this account
	allocations, _ := u.repo.FindAllocationsByAccountID(*tx.AccountID)

	for _, source := range sources {
		// Skip if goal is not active
		if source.Goal == nil || source.Goal.Status != "active" {
			continue
		}

		// Calculate amount for this goal
		amount := tx.Amount
		if len(sources) > 1 {
			// Check if there's a specific allocation
			found := false
			for _, alloc := range allocations {
				if alloc.GoalID == source.GoalID {
					amount = tx.Amount * (alloc.Percentage / 100)
					found = true
					break
				}
			}
			if !found {
				// Split equally
				amount = tx.Amount / float64(len(sources))
			}
		}

		// Create contribution
		contribution := &entity.SavingsGoalContribution{
			GoalID:        source.GoalID,
			SourceID:      source.ID,
			UserID:        source.Goal.UserID,
			TransactionID: &tx.ID,
			Amount:        amount,
			Type:          "auto",
			ContributedAt: time.Now(),
		}

		if err := u.repo.CreateContribution(contribution); err != nil {
			if errors.Is(err, gorm.ErrDuplicatedKey) {
				continue // anti-double count
			}
			return err
		}

		// Update amounts
		u.repo.UpdateCurrentAmount(source.GoalID, amount)
		source.CurrentAmount += amount
		u.repo.UpdateSource(&source)

		// Check if achieved
		goal, _ := u.repo.FindByID(source.GoalID)
		if goal != nil && goal.CurrentAmount >= goal.TargetAmount {
			u.UpdateGoalStatus(source.GoalID, source.Goal.UserID, "achieved")
		}
	}

	return nil
}

// --- Allocations ---

func (u *savingsGoalUsecase) GetAllocations(userID uuid.UUID) ([]entity.SavingsGoalAllocation, error) {
	// Get all goals for user, then get allocations
	goals, err := u.repo.FindByUserID(userID, "active")
	if err != nil {
		return nil, err
	}

	var allAllocations []entity.SavingsGoalAllocation
	for _, g := range goals {
		allocations, err := u.repo.FindAllocationsByGoalID(g.ID)
		if err != nil {
			continue
		}
		allAllocations = append(allAllocations, allocations...)
	}
	return allAllocations, nil
}

func (u *savingsGoalUsecase) SetAllocations(userID uuid.UUID, input []domainUsecase.SetAllocationInput) error {
	// Validate: total per account <= 100%
	accountTotals := make(map[uuid.UUID]float64)
	for _, alloc := range input {
		accountTotals[alloc.AccountID] += alloc.Percentage
	}
	for _, total := range accountTotals {
		if total > 100 {
			return errors.New("total allocation per account cannot exceed 100%")
		}
	}

	var allocations []entity.SavingsGoalAllocation
	for _, a := range input {
		allocations = append(allocations, entity.SavingsGoalAllocation{
			AccountID:  a.AccountID,
			GoalID:     a.GoalID,
			SourceID:   a.SourceID,
			Percentage: a.Percentage,
		})
	}

	return u.repo.UpsertAllocations(allocations)
}

// --- Summary ---

func (u *savingsGoalUsecase) GetSummary(userID uuid.UUID) (*domainRepo.SavingsGoalSummary, error) {
	return u.repo.GetSummary(userID)
}

// --- Helpers ---

func (u *savingsGoalUsecase) resolveTrackingMode(sourceType, requestedMode string) string {
	// Only saving_account can be auto
	if sourceType == "saving_account" && requestedMode == "auto" {
		return "auto"
	}
	return "manual"
}
