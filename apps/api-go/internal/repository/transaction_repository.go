package repository

import (
	"context"
	"errors"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type transactionRepository struct {
	db *gorm.DB
}

func NewTransactionRepository(db *gorm.DB) domainrepo.TransactionRepository {
	return &transactionRepository{db: db}
}

func (r *transactionRepository) FindAll(ctx context.Context, userID uuid.UUID, q domainrepo.ListTransactionsQuery) ([]entity.Transaction, int64, error) {
	db := r.db.WithContext(ctx).Model(&entity.Transaction{}).
		Where("user_id = ? AND deleted_at IS NULL", userID)

	if q.Type != "" {
		db = db.Where("type = ?", q.Type)
	}
	if q.StartDate != nil {
		db = db.Where("date >= ?", q.StartDate)
	}
	if q.EndDate != nil {
		db = db.Where("date <= ?", q.EndDate)
	}
	if q.CategoryID != nil {
		db = db.Where("category_id = ?", q.CategoryID)
	}
	if q.AccountID != nil {
		db = db.Where("account_id = ?", q.AccountID)
	}
	if q.Search != "" {
		db = db.Where("description ILIKE ?", "%"+q.Search+"%")
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page := q.Page
	if page < 1 {
		page = 1
	}
	limit := q.Limit
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var txs []entity.Transaction
	err := db.Preload("Category").Preload("Account").
		Order("date DESC, created_at DESC").
		Limit(limit).Offset(offset).
		Find(&txs).Error
	return txs, total, err
}

func (r *transactionRepository) FindByID(ctx context.Context, userID, id uuid.UUID) (*entity.Transaction, error) {
	var tx entity.Transaction
	err := r.db.WithContext(ctx).
		Preload("Category").Preload("Account").
		Where("id = ? AND user_id = ? AND deleted_at IS NULL", id, userID).
		First(&tx).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &tx, nil
}

func (r *transactionRepository) Create(ctx context.Context, tx *entity.Transaction) error {
	return r.db.WithContext(ctx).Create(tx).Error
}

func (r *transactionRepository) Update(ctx context.Context, userID, id uuid.UUID, data map[string]interface{}) (*entity.Transaction, error) {
	data["is_manually_edited"] = true
	err := r.db.WithContext(ctx).Model(&entity.Transaction{}).
		Where("id = ? AND user_id = ? AND deleted_at IS NULL", id, userID).
		Updates(data).Error
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, userID, id)
}

func (r *transactionRepository) SoftDelete(ctx context.Context, userID, id uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&entity.Transaction{}).
		Where("id = ? AND user_id = ? AND deleted_at IS NULL", id, userID).
		Updates(map[string]interface{}{
			"deleted_at": now,
			"status":     "deleted",
		}).Error
}

type summaryRow struct {
	Type  string
	Total float64
	Count int64
}

func (r *transactionRepository) GetSummary(ctx context.Context, userID uuid.UUID, start, end time.Time) (*domainrepo.TransactionSummary, error) {
	var rows []summaryRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT type, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
		FROM transactions
		WHERE user_id = ? AND deleted_at IS NULL AND date BETWEEN ? AND ?
		GROUP BY type
	`, userID, start, end).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	summary := &domainrepo.TransactionSummary{}
	for _, row := range rows {
		switch row.Type {
		case "income":
			summary.Income = row.Total
		case "expense":
			summary.Expense = row.Total
		case "transfer":
			summary.Transfer = row.Total
		}
		summary.TransactionCount += row.Count
	}
	summary.Net = summary.Income - summary.Expense
	return summary, nil
}

func (r *transactionRepository) GetCategoryBreakdown(ctx context.Context, userID uuid.UUID, txType string, start, end time.Time) ([]domainrepo.CategoryBreakdownRow, error) {
	if txType == "" {
		txType = "expense"
	}
	rows := make([]domainrepo.CategoryBreakdownRow, 0) // always return [] not null
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			t.category_id,
			c.name AS category_name,
			c.icon AS category_icon,
			c.color AS category_color,
			COALESCE(SUM(t.amount), 0) AS total,
			COUNT(*) AS count
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.user_id = ? AND t.type = ? AND t.deleted_at IS NULL AND t.date BETWEEN ? AND ?
		GROUP BY t.category_id, c.name, c.icon, c.color
		ORDER BY total DESC
	`, userID, txType, start, end).Scan(&rows).Error
	return rows, err
}

func (r *transactionRepository) GetMonthlyTrend(ctx context.Context, userID uuid.UUID, months int) ([]domainrepo.MonthlyTrendRow, error) {
	if months < 1 {
		months = 6
	}
	startDate := time.Now().AddDate(0, -months+1, 0)
	startDate = time.Date(startDate.Year(), startDate.Month(), 1, 0, 0, 0, 0, startDate.Location())

	rows := make([]domainrepo.MonthlyTrendRow, 0) // always return [] not null
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			TO_CHAR(date, 'YYYY-MM') AS month,
			type,
			COALESCE(SUM(amount), 0) AS total
		FROM transactions
		WHERE user_id = ? AND deleted_at IS NULL AND date >= ?
		GROUP BY month, type
		ORDER BY month ASC, type ASC
	`, userID, startDate).Scan(&rows).Error
	return rows, err
}

func (r *transactionRepository) ExistsByAmountMerchantWindow(ctx context.Context, userID uuid.UUID, bank, txType string, amountCents int64, merchantNorm string, after time.Time) (bool, error) {
	amount := float64(amountCents) / 100
	var count int64
	err := r.db.WithContext(ctx).Model(&entity.Transaction{}).
		Where(`user_id = ? AND deleted_at IS NULL AND type = ? AND amount = ? AND date >= ?
			AND LOWER(COALESCE(merchant, '')) = ?
			AND raw_data::text ILIKE ?`,
			userID, txType, amount, after, merchantNorm, "%"+bank+"%").
		Count(&count).Error
	return count > 0, err
}

func (r *transactionRepository) FindAllByUserIDs(ctx context.Context, userIDs []uuid.UUID, q domainrepo.ListTransactionsQuery) ([]entity.Transaction, int64, error) {
	if len(userIDs) == 0 {
		return nil, 0, nil
	}
	db := r.db.WithContext(ctx).Model(&entity.Transaction{}).
		Where("user_id IN ? AND deleted_at IS NULL", userIDs)

	if q.Type != "" {
		db = db.Where("type = ?", q.Type)
	}
	if q.StartDate != nil {
		db = db.Where("date >= ?", q.StartDate)
	}
	if q.EndDate != nil {
		db = db.Where("date <= ?", q.EndDate)
	}
	if q.CategoryID != nil {
		db = db.Where("category_id = ?", q.CategoryID)
	}
	if q.AccountID != nil {
		db = db.Where("account_id = ?", q.AccountID)
	}
	if q.Search != "" {
		db = db.Where("description ILIKE ?", "%"+q.Search+"%")
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page := q.Page
	if page < 1 {
		page = 1
	}
	limit := q.Limit
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	var txs []entity.Transaction
	err := db.Preload("Category").Preload("Account").
		Order("date DESC, created_at DESC").
		Limit(limit).Offset(offset).
		Find(&txs).Error
	return txs, total, err
}

func (r *transactionRepository) GetSummaryByUserIDs(ctx context.Context, userIDs []uuid.UUID, start, end time.Time) (*domainrepo.TransactionSummary, error) {
	if len(userIDs) == 0 {
		return &domainrepo.TransactionSummary{}, nil
	}
	var rows []summaryRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT type, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
		FROM transactions
		WHERE user_id IN ? AND deleted_at IS NULL AND date BETWEEN ? AND ?
		GROUP BY type
	`, userIDs, start, end).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	summary := &domainrepo.TransactionSummary{}
	for _, row := range rows {
		switch row.Type {
		case "income":
			summary.Income = row.Total
		case "expense":
			summary.Expense = row.Total
		case "transfer":
			summary.Transfer = row.Total
		}
		summary.TransactionCount += row.Count
	}
	summary.Net = summary.Income - summary.Expense
	return summary, nil
}

func (r *transactionRepository) GetCategoryBreakdownByUserIDs(ctx context.Context, userIDs []uuid.UUID, txType string, start, end time.Time) ([]domainrepo.CategoryBreakdownRow, error) {
	if len(userIDs) == 0 {
		return []domainrepo.CategoryBreakdownRow{}, nil
	}
	if txType == "" {
		txType = "expense"
	}
	rows := make([]domainrepo.CategoryBreakdownRow, 0)
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			t.category_id,
			c.name AS category_name,
			c.icon AS category_icon,
			c.color AS category_color,
			COALESCE(SUM(t.amount), 0) AS total,
			COUNT(*) AS count
		FROM transactions t
		LEFT JOIN categories c ON t.category_id = c.id
		WHERE t.user_id IN ? AND t.type = ? AND t.deleted_at IS NULL AND t.date BETWEEN ? AND ?
		GROUP BY t.category_id, c.name, c.icon, c.color
		ORDER BY total DESC
	`, userIDs, txType, start, end).Scan(&rows).Error
	return rows, err
}

func (r *transactionRepository) GetMonthlyTrendByUserIDs(ctx context.Context, userIDs []uuid.UUID, months int) ([]domainrepo.MonthlyTrendRow, error) {
	if len(userIDs) == 0 {
		return []domainrepo.MonthlyTrendRow{}, nil
	}
	if months < 1 {
		months = 6
	}
	startDate := time.Now().AddDate(0, -months+1, 0)
	startDate = time.Date(startDate.Year(), startDate.Month(), 1, 0, 0, 0, 0, startDate.Location())

	rows := make([]domainrepo.MonthlyTrendRow, 0)
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			TO_CHAR(date, 'YYYY-MM') AS month,
			type,
			COALESCE(SUM(amount), 0) AS total
		FROM transactions
		WHERE user_id IN ? AND deleted_at IS NULL AND date >= ?
		GROUP BY month, type
		ORDER BY month ASC, type ASC
	`, userIDs, startDate).Scan(&rows).Error
	return rows, err
}
