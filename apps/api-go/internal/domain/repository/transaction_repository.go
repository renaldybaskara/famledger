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

type DailyActivityRow struct {
	Day   string  `json:"date"`
	Type  string  `json:"-"`
	Total float64 `json:"-"`
	Count int64   `json:"-"`
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
	// ExistsByAmountMerchantWindow returns true when a non-deleted transaction already exists
	// for the same user/bank/type/amount/merchant within the given lookback window.
	// Used for fuzzy-dedup of banks (e.g. BRI) that send the same notification twice.
	ExistsByAmountMerchantWindow(ctx context.Context, userID uuid.UUID, bank, txType string, amountCents int64, merchantNorm string, after time.Time) (bool, error)

	// Multi-user variants for workspace shared views.
	// Accepts a pre-fetched list of user IDs (collected from workspace_members)
	// so no subquery JOIN is needed — two separate queries in the application layer.
	FindAllByUserIDs(ctx context.Context, userIDs []uuid.UUID, q ListTransactionsQuery) ([]entity.Transaction, int64, error)
	GetSummaryByUserIDs(ctx context.Context, userIDs []uuid.UUID, start, end time.Time) (*TransactionSummary, error)
	GetCategoryBreakdownByUserIDs(ctx context.Context, userIDs []uuid.UUID, txType string, start, end time.Time) ([]CategoryBreakdownRow, error)
	GetMonthlyTrendByUserIDs(ctx context.Context, userIDs []uuid.UUID, months int) ([]MonthlyTrendRow, error)
	// GetTrendByDateRangeByUserIDs groups transactions by calendar month within an
	// explicit date range. Used by the payday filter so the chart reflects the
	// actual payday period instead of the default last-N-months window.
	GetTrendByDateRangeByUserIDs(ctx context.Context, userIDs []uuid.UUID, start, end time.Time) ([]MonthlyTrendRow, error)
	// GetDailyActivityByUserIDs returns per-day aggregated totals grouped by type
	// within a date range. Used by the calendar heatmap widget.
	GetDailyActivityByUserIDs(ctx context.Context, userIDs []uuid.UUID, start, end time.Time) ([]DailyActivityRow, error)
}
