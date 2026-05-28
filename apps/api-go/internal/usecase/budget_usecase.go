package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/google/uuid"
)

type budgetUseCase struct {
	repo domainrepo.BudgetRepository
}

func NewBudgetUseCase(repo domainrepo.BudgetRepository) domainuc.BudgetUseCase {
	return &budgetUseCase{repo: repo}
}

func (uc *budgetUseCase) FindAll(ctx context.Context, userID uuid.UUID) ([]domainuc.BudgetWithStats, error) {
	budgets, err := uc.repo.FindAllByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Get spending for current month
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	end := start.AddDate(0, 1, 0).Add(-time.Nanosecond)
	spending, err := uc.repo.GetSpendingByCategory(ctx, userID, start, end)
	if err != nil {
		return nil, err
	}

	result := make([]domainuc.BudgetWithStats, 0, len(budgets))
	for _, b := range budgets {
		var spent float64
		if b.CategoryID != nil {
			spent = spending[*b.CategoryID]
		}

		remaining := b.Amount - spent
		var percentage float64
		if b.Amount > 0 {
			percentage = (spent / b.Amount) * 100
		}

		status := computeBudgetStatus(spent, b.Amount)

		result = append(result, domainuc.BudgetWithStats{
			Budget:     b,
			Spent:      spent,
			Remaining:  remaining,
			Percentage: percentage,
			Status:     status,
		})
	}
	return result, nil
}

func (uc *budgetUseCase) Create(ctx context.Context, userID uuid.UUID, in domainuc.CreateBudgetInput) (*entity.Budget, error) {
	budget := &entity.Budget{
		ID:        uuid.New(),
		UserID:    userID,
		Name:      in.Name,
		Amount:    in.Amount,
		Period:    in.Period,
		StartDate: in.StartDate,
		EndDate:   in.EndDate,
		IsActive:  true,
	}
	if in.CategoryID != nil {
		budget.CategoryID = in.CategoryID
	}
	if in.CarryOver != nil {
		budget.CarryOver = *in.CarryOver
	}
	if in.AlertAt80 != nil {
		budget.AlertAt80 = *in.AlertAt80
	} else {
		budget.AlertAt80 = true
	}
	if in.AlertAt100 != nil {
		budget.AlertAt100 = *in.AlertAt100
	} else {
		budget.AlertAt100 = true
	}
	if in.AlertAt120 != nil {
		budget.AlertAt120 = *in.AlertAt120
	}

	if err := uc.repo.Create(ctx, budget); err != nil {
		return nil, err
	}
	return budget, nil
}

func (uc *budgetUseCase) Update(ctx context.Context, userID, id uuid.UUID, in domainuc.UpdateBudgetInput) (*entity.Budget, error) {
	existing, err := uc.repo.FindByID(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, errors.New("budget not found")
	}

	data := make(map[string]interface{})
	if in.Name != nil {
		data["name"] = *in.Name
	}
	if in.Amount != nil {
		data["amount"] = *in.Amount
	}
	if in.CategoryID != nil {
		data["category_id"] = *in.CategoryID
	}
	if in.Period != nil {
		data["period"] = *in.Period
	}
	if in.StartDate != nil {
		data["start_date"] = *in.StartDate
	}
	if in.EndDate != nil {
		data["end_date"] = *in.EndDate
	}
	return uc.repo.Update(ctx, userID, id, data)
}

func (uc *budgetUseCase) Delete(ctx context.Context, userID, id uuid.UUID) error {
	existing, err := uc.repo.FindByID(ctx, userID, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.New("budget not found")
	}
	return uc.repo.Delete(ctx, userID, id)
}

func (uc *budgetUseCase) FindSubscriptions(ctx context.Context, userID uuid.UUID) ([]entity.Subscription, error) {
	return uc.repo.FindSubscriptionsByUserID(ctx, userID)
}

func computeBudgetStatus(spent, limit float64) string {
	if limit <= 0 {
		return "ok"
	}
	ratio := spent / limit
	switch {
	case ratio >= 1.2:
		return "critical"
	case ratio >= 1.0:
		return "over"
	case ratio >= 0.8:
		return "warning"
	default:
		return "ok"
	}
}
