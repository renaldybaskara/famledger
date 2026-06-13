package usecase

import (
	"context"
	"errors"
	"math"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/google/uuid"
)

type transactionUseCase struct {
	repo domainrepo.TransactionRepository
}

func NewTransactionUseCase(repo domainrepo.TransactionRepository) domainuc.TransactionUseCase {
	return &transactionUseCase{repo: repo}
}

func (uc *transactionUseCase) FindAll(ctx context.Context, userID uuid.UUID, q domainrepo.ListTransactionsQuery) (*domainuc.PaginatedTransactions, error) {
	txs, total, err := uc.repo.FindAll(ctx, userID, q)
	if err != nil {
		return nil, err
	}

	limit := q.Limit
	if limit < 1 {
		limit = 20
	}
	page := q.Page
	if page < 1 {
		page = 1
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages < 1 {
		totalPages = 1
	}

	return &domainuc.PaginatedTransactions{
		Data: txs,
		Pagination: domainuc.PaginationMeta{
			Page:       page,
			Limit:      limit,
			Total:      total,
			TotalPages: totalPages,
		},
	}, nil
}

func (uc *transactionUseCase) FindByID(ctx context.Context, userID, id uuid.UUID) (*entity.Transaction, error) {
	tx, err := uc.repo.FindByID(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if tx == nil {
		return nil, errors.New("transaction not found")
	}
	return tx, nil
}

func (uc *transactionUseCase) Create(ctx context.Context, userID uuid.UUID, in domainuc.CreateTransactionInput) (*entity.Transaction, error) {
	tx := &entity.Transaction{
		ID:          uuid.New(),
		UserID:      userID,
		Type:        in.Type,
		Amount:      in.Amount,
		Date:        in.Date,
		CategoryID:  in.CategoryID,
		AccountID:   in.AccountID,
		Description: in.Description,
		Merchant:    in.Merchant,
		Note:        in.Note,
		Source:      "manual",
		Status:      "confirmed",
	}
	if in.Currency != nil {
		tx.Currency = *in.Currency
	} else {
		tx.Currency = "IDR"
	}
	if in.IdempotencyKey != nil {
		tx.IdempotencyKey = in.IdempotencyKey
	}

	if err := uc.repo.Create(ctx, tx); err != nil {
		return nil, err
	}
	// Reload with associations
	return uc.repo.FindByID(ctx, userID, tx.ID)
}

func (uc *transactionUseCase) Update(ctx context.Context, userID, id uuid.UUID, in domainuc.UpdateTransactionInput) (*entity.Transaction, error) {
	existing, err := uc.repo.FindByID(ctx, userID, id)
	if err != nil || existing == nil {
		return nil, errors.New("transaction not found")
	}

	data := make(map[string]interface{})
	if in.Type != nil {
		data["type"] = *in.Type
	}
	if in.Amount != nil {
		data["amount"] = *in.Amount
	}
	if in.Date != nil {
		data["date"] = *in.Date
	}
	if in.CategoryID != nil {
		data["category_id"] = *in.CategoryID
	}
	if in.AccountID != nil {
		data["account_id"] = *in.AccountID
	}
	if in.Description != nil {
		data["description"] = *in.Description
	}
	if in.Merchant != nil {
		data["merchant"] = *in.Merchant
	}
	if in.Note != nil {
		data["note"] = *in.Note
	}

	return uc.repo.Update(ctx, userID, id, data)
}

func (uc *transactionUseCase) Delete(ctx context.Context, userID, id uuid.UUID) error {
	existing, err := uc.repo.FindByID(ctx, userID, id)
	if err != nil || existing == nil {
		return errors.New("transaction not found")
	}
	return uc.repo.SoftDelete(ctx, userID, id)
}

func (uc *transactionUseCase) GetSummary(ctx context.Context, userID uuid.UUID, start, end time.Time) (*domainrepo.TransactionSummary, error) {
	return uc.repo.GetSummary(ctx, userID, start, end)
}

func (uc *transactionUseCase) GetCategoryBreakdown(ctx context.Context, userID uuid.UUID, txType string, start, end time.Time) ([]domainrepo.CategoryBreakdownRow, error) {
	return uc.repo.GetCategoryBreakdown(ctx, userID, txType, start, end)
}

func (uc *transactionUseCase) GetMonthlyTrend(ctx context.Context, userID uuid.UUID, months int) ([]domainrepo.MonthlyTrendRow, error) {
	return uc.repo.GetMonthlyTrend(ctx, userID, months)
}

func (uc *transactionUseCase) GetSummaryByUserIDs(ctx context.Context, userIDs []uuid.UUID, start, end time.Time) (*domainrepo.TransactionSummary, error) {
	return uc.repo.GetSummaryByUserIDs(ctx, userIDs, start, end)
}

func (uc *transactionUseCase) GetCategoryBreakdownByUserIDs(ctx context.Context, userIDs []uuid.UUID, txType string, start, end time.Time) ([]domainrepo.CategoryBreakdownRow, error) {
	return uc.repo.GetCategoryBreakdownByUserIDs(ctx, userIDs, txType, start, end)
}

func (uc *transactionUseCase) GetMonthlyTrendByUserIDs(ctx context.Context, userIDs []uuid.UUID, months int) ([]domainrepo.MonthlyTrendRow, error) {
	return uc.repo.GetMonthlyTrendByUserIDs(ctx, userIDs, months)
}
