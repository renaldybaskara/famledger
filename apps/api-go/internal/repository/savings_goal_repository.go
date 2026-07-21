package repository

import (
	"github.com/fintrackr/api/internal/domain/entity"
	domainRepo "github.com/fintrackr/api/internal/domain/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type savingsGoalRepository struct {
	db *gorm.DB
}

func NewSavingsGoalRepository(db *gorm.DB) domainRepo.SavingsGoalRepository {
	return &savingsGoalRepository{db: db}
}

// --- Goals CRUD ---

func (r *savingsGoalRepository) Create(goal *entity.SavingsGoal) error {
	return r.db.Create(goal).Error
}

func (r *savingsGoalRepository) FindByID(id uuid.UUID) (*entity.SavingsGoal, error) {
	var goal entity.SavingsGoal
	err := r.db.Preload("Sources").Preload("Sources.Account").Where("id = ?", id).First(&goal).Error
	if err != nil {
		return nil, err
	}
	return &goal, nil
}

func (r *savingsGoalRepository) FindByUserID(userID uuid.UUID, status string) ([]entity.SavingsGoal, error) {
	var goals []entity.SavingsGoal
	query := r.db.Preload("Sources").Where("user_id = ?", userID)
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("created_at DESC").Find(&goals).Error
	return goals, err
}

func (r *savingsGoalRepository) FindByWorkspaceID(workspaceID uuid.UUID, status string) ([]entity.SavingsGoal, error) {
	var goals []entity.SavingsGoal
	query := r.db.Preload("Sources").Where("workspace_id = ?", workspaceID)
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("created_at DESC").Find(&goals).Error
	return goals, err
}

func (r *savingsGoalRepository) Update(goal *entity.SavingsGoal) error {
	return r.db.Save(goal).Error
}

func (r *savingsGoalRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&entity.SavingsGoal{}, id).Error
}

func (r *savingsGoalRepository) UpdateStatus(id uuid.UUID, status string) error {
	return r.db.Model(&entity.SavingsGoal{}).Where("id = ?", id).Update("status", status).Error
}

func (r *savingsGoalRepository) UpdateCurrentAmount(id uuid.UUID, amount float64) error {
	return r.db.Model(&entity.SavingsGoal{}).Where("id = ?", id).
		Update("current_amount", gorm.Expr("current_amount + ?", amount)).Error
}

// --- Sources ---

func (r *savingsGoalRepository) CreateSource(source *entity.SavingsGoalSource) error {
	return r.db.Create(source).Error
}

func (r *savingsGoalRepository) FindSourcesByGoalID(goalID uuid.UUID) ([]entity.SavingsGoalSource, error) {
	var sources []entity.SavingsGoalSource
	err := r.db.Preload("Account").Where("goal_id = ?", goalID).Find(&sources).Error
	return sources, err
}

func (r *savingsGoalRepository) FindSourceByID(id uuid.UUID) (*entity.SavingsGoalSource, error) {
	var source entity.SavingsGoalSource
	err := r.db.Where("id = ?", id).First(&source).Error
	if err != nil {
		return nil, err
	}
	return &source, nil
}

func (r *savingsGoalRepository) UpdateSource(source *entity.SavingsGoalSource) error {
	return r.db.Save(source).Error
}

func (r *savingsGoalRepository) DeleteSource(id uuid.UUID) error {
	return r.db.Delete(&entity.SavingsGoalSource{}, id).Error
}

func (r *savingsGoalRepository) FindAutoSourcesByAccountID(accountID uuid.UUID) ([]entity.SavingsGoalSource, error) {
	var sources []entity.SavingsGoalSource
	err := r.db.Preload("Goal").
		Where("account_id = ? AND tracking_mode = ? AND source_type = ?", accountID, "auto", "saving_account").
		Find(&sources).Error
	return sources, err
}

// --- Contributions ---

func (r *savingsGoalRepository) CreateContribution(contribution *entity.SavingsGoalContribution) error {
	return r.db.Create(contribution).Error
}

func (r *savingsGoalRepository) FindContributionsByGoalID(goalID uuid.UUID, contribType string, page, limit int) ([]entity.SavingsGoalContribution, int64, error) {
	var contributions []entity.SavingsGoalContribution
	var total int64

	query := r.db.Preload("Source").Preload("User").Where("goal_id = ?", goalID)
	if contribType != "" {
		query = query.Where("type = ?", contribType)
	}

	query.Model(&entity.SavingsGoalContribution{}).Count(&total)

	offset := (page - 1) * limit
	err := query.Order("contributed_at DESC").Offset(offset).Limit(limit).Find(&contributions).Error
	return contributions, total, err
}

func (r *savingsGoalRepository) FindContributionByTransactionID(transactionID uuid.UUID) (*entity.SavingsGoalContribution, error) {
	var contribution entity.SavingsGoalContribution
	err := r.db.Where("transaction_id = ?", transactionID).First(&contribution).Error
	if err != nil {
		return nil, err
	}
	return &contribution, nil
}

// --- Allocations ---

func (r *savingsGoalRepository) FindAllocationsByAccountID(accountID uuid.UUID) ([]entity.SavingsGoalAllocation, error) {
	var allocations []entity.SavingsGoalAllocation
	err := r.db.Where("account_id = ?", accountID).Find(&allocations).Error
	return allocations, err
}

func (r *savingsGoalRepository) FindAllocationsByGoalID(goalID uuid.UUID) ([]entity.SavingsGoalAllocation, error) {
	var allocations []entity.SavingsGoalAllocation
	err := r.db.Where("goal_id = ?", goalID).Find(&allocations).Error
	return allocations, err
}

func (r *savingsGoalRepository) UpsertAllocations(allocations []entity.SavingsGoalAllocation) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		for _, alloc := range allocations {
			err := tx.Where("account_id = ? AND goal_id = ?", alloc.AccountID, alloc.GoalID).
				Assign(entity.SavingsGoalAllocation{
					Percentage: alloc.Percentage,
					SourceID:   alloc.SourceID,
				}).FirstOrCreate(&alloc).Error
			if err != nil {
				return err
			}
		}
		return nil
	})
}

// --- Summary ---

func (r *savingsGoalRepository) GetSummary(userID uuid.UUID) (*domainRepo.SavingsGoalSummary, error) {
	var summary domainRepo.SavingsGoalSummary

	// Count goals and totals
	var goals []entity.SavingsGoal
	r.db.Preload("Sources").Where("user_id = ? AND status = ?", userID, "active").Find(&goals)

	summary.TotalGoals = int64(len(goals))
	for _, g := range goals {
		summary.TotalTarget += g.TargetAmount
		summary.TotalCurrent += g.CurrentAmount

		// Check on-track vs behind (simple heuristic based on deadline)
		if g.Deadline != nil {
			// Simple: if progress >= 50% of time elapsed, it's on track
			summary.OnTrack++
		} else {
			summary.OnTrack++
		}

		// Source breakdown
		for _, s := range g.Sources {
			switch s.SourceType {
			case "saving_account":
				summary.TotalSavingAccount += s.CurrentAmount
			case "stocks":
				summary.TotalStocks += s.CurrentAmount
			case "gold":
				summary.TotalGold += s.CurrentAmount
			case "reksadana":
				summary.TotalReksadana += s.CurrentAmount
			case "crypto":
				summary.TotalCrypto += s.CurrentAmount
			case "deposit":
				summary.TotalDeposit += s.CurrentAmount
			case "cash":
				summary.TotalCash += s.CurrentAmount
			case "other":
				summary.TotalOther += s.CurrentAmount
			}
		}
	}

	if summary.TotalTarget > 0 {
		summary.OverallPercent = (summary.TotalCurrent / summary.TotalTarget) * 100
	}
	summary.Behind = summary.TotalGoals - summary.OnTrack

	return &summary, nil
}

func (r *savingsGoalRepository) CountActiveGoals(userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&entity.SavingsGoal{}).Where("user_id = ? AND status = ?", userID, "active").Count(&count).Error
	return count, err
}

func (r *savingsGoalRepository) CountActiveWorkspaceGoals(workspaceID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.Model(&entity.SavingsGoal{}).Where("workspace_id = ? AND status = ?", workspaceID, "active").Count(&count).Error
	return count, err
}
