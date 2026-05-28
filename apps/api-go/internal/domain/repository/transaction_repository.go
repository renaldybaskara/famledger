package repository

import (
	"context"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type ListTransactionsQuery struct {
	Page       int
	Limit      int
	Type       string
	StartDate  *time.Time
	EndDate    *time.Time
	CategoryID *uuid.UUID
	AccountID  *uuid.UUID
	Search     string
}

type CategoryBreakdownRow struct {
	CategoryID    *uuid.UUID `json:"categoryId"`
	CategoryName  *string    `json:"categoryName"`
	CategoryIcon  *string    `json:"categoryIcon"`
	CategoryColor *string    `json:"categoryColor"`
	Total         float64    `json:"total"`
	Count         int64      `json:"count"`
}

type MonthlyTrendRow struct {
	Month string  `json:"month"`
	Type  string  `json:"type"`
	Total float64 `json:"total"`
}

type TransactionSummary struct {
	Income           float64 `json:"income"`
	Expense          float64 `json:"expense"`
	Transfer         float64 `json:"transfer"`
	TransactionCount int64   `json:"transactionCount"`
	Net              float64 `json:"net"`
}

type TransactionRepository interface {
	FindAll(ctx context.Context, userID uuid.UUID, q ListTransactionsQuery) ([]entity.Transaction, int64, error)
	FindByID(ctx context.Context, userID, id uuid.UUID) (*entity.Transaction, error)
	Create(ctx context.Context, tx *entity.Transaction) error
	Update(ctx context.Context, userID, id uuid.UUID, data map[string]interface{}) (*entity.Transaction, error)
	SoftDelete(ctx context.Context, userID, id uuid.UUID) error
	GetSummary(ctx context.Context, userID uuid.UUID, start, end time.Time) (*TransactionSummary, error)
	GetCategoryBreakdown(ctx context.Context, userID uuid.UUID, txType string, start, end time.Time) ([]CategoryBreakdownRow, error)
	GetMonthlyTrend(ctx context.Context, userID uuid.UUID, months int) ([]MonthlyTrendRow, error)
}
