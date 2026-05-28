package usecase

import (
	"context"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/fintrackr/api/internal/domain/repository"
	"github.com/google/uuid"
)

type CreateTransactionInput struct {
	Type           string
	Amount         float64
	Date           time.Time
	CategoryID     *uuid.UUID
	AccountID      *uuid.UUID
	Description    *string
	Merchant       *string
	Note           *string
	Currency       *string
	IdempotencyKey *string
}

type UpdateTransactionInput struct {
	Type        *string
	Amount      *float64
	Date        *time.Time
	CategoryID  *uuid.UUID
	AccountID   *uuid.UUID
	Description *string
	Merchant    *string
	Note        *string
}

type PaginatedTransactions struct {
	Data       []entity.Transaction      `json:"data"`
	Pagination PaginationMeta            `json:"pagination"`
}

type PaginationMeta struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"totalPages"`
}

type TransactionUseCase interface {
	FindAll(ctx context.Context, userID uuid.UUID, q repository.ListTransactionsQuery) (*PaginatedTransactions, error)
	FindByID(ctx context.Context, userID, id uuid.UUID) (*entity.Transaction, error)
	Create(ctx context.Context, userID uuid.UUID, in CreateTransactionInput) (*entity.Transaction, error)
	Update(ctx context.Context, userID, id uuid.UUID, in UpdateTransactionInput) (*entity.Transaction, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
	GetSummary(ctx context.Context, userID uuid.UUID, start, end time.Time) (*repository.TransactionSummary, error)
	GetCategoryBreakdown(ctx context.Context, userID uuid.UUID, txType string, start, end time.Time) ([]repository.CategoryBreakdownRow, error)
	GetMonthlyTrend(ctx context.Context, userID uuid.UUID, months int) ([]repository.MonthlyTrendRow, error)
}
