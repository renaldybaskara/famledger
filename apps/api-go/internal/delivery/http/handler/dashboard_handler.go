package handler

import (
	"strconv"
	"time"

	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DashboardHandler struct {
	txUC domainuc.TransactionUseCase
}

func NewDashboardHandler(txUC domainuc.TransactionUseCase) *DashboardHandler {
	return &DashboardHandler{txUC: txUC}
}

// GET /api/dashboard/summary
// Query params: startDate, endDate (optional — defaults to current month)
// Returns current period + previous period for comparison
func (h *DashboardHandler) Summary(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	start, end := parseOrCurrentMonth(c.Query("startDate"), c.Query("endDate"))

	// Current period
	summary, err := h.txUC.GetSummary(c.Request.Context(), userID, start, end)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}

	// Previous period (same duration, shifted back)
	duration := end.Sub(start)
	prevEnd := start.Add(-time.Nanosecond)
	prevStart := prevEnd.Add(-duration)

	prevSummary, err := h.txUC.GetSummary(c.Request.Context(), userID, prevStart, prevEnd)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}

	httputil.OK(c, gin.H{
		// Current period
		"totalIncome":      summary.Income,
		"totalExpense":     summary.Expense,
		"totalTransfer":    summary.Transfer,
		"netBalance":       summary.Net,
		"transactionCount": summary.TransactionCount,
		// Previous period
		"previousPeriod": gin.H{
			"totalIncome":      prevSummary.Income,
			"totalExpense":     prevSummary.Expense,
			"totalTransfer":    prevSummary.Transfer,
			"netBalance":       prevSummary.Net,
			"transactionCount": prevSummary.TransactionCount,
		},
		// % change helpers (null-safe)
		"incomeChange":     percentChange(prevSummary.Income, summary.Income),
		"expenseChange":    percentChange(prevSummary.Expense, summary.Expense),
		"netBalanceChange": percentChange(prevSummary.Net, summary.Net),
		// Period info
		"period": gin.H{
			"startDate": start.Format("2006-01-02"),
			"endDate":   end.Format("2006-01-02"),
		},
	})
}

// GET /api/dashboard/category-breakdown
func (h *DashboardHandler) CategoryBreakdown(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	txType := c.DefaultQuery("type", "expense")
	start, end := parseOrCurrentMonth(c.Query("startDate"), c.Query("endDate"))

	rows, err := h.txUC.GetCategoryBreakdown(c.Request.Context(), userID, txType, start, end)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, rows)
}

// GET /api/dashboard/monthly-trend
func (h *DashboardHandler) MonthlyTrend(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	months, _ := strconv.Atoi(c.DefaultQuery("months", "6"))
	if months < 1 || months > 24 {
		months = 6
	}

	rows, err := h.txUC.GetMonthlyTrend(c.Request.Context(), userID, months)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}

	// Pivot rows: [{month, type, total}] → [{month, income, expense, transfer}]
	type pivotRow struct {
		Month    string  `json:"month"`
		Income   float64 `json:"income"`
		Expense  float64 `json:"expense"`
		Transfer float64 `json:"transfer"`
	}
	pivotMap := make(map[string]*pivotRow)
	monthOrder := make([]string, 0)
	for _, r := range rows {
		if _, ok := pivotMap[r.Month]; !ok {
			pivotMap[r.Month] = &pivotRow{Month: r.Month}
			monthOrder = append(monthOrder, r.Month)
		}
		switch r.Type {
		case "income":
			pivotMap[r.Month].Income = r.Total
		case "expense":
			pivotMap[r.Month].Expense = r.Total
		case "transfer":
			pivotMap[r.Month].Transfer = r.Total
		}
	}
	result := make([]pivotRow, 0, len(monthOrder))
	for _, m := range monthOrder {
		result = append(result, *pivotMap[m])
	}
	httputil.OK(c, result)
}

// parseOrCurrentMonth parses date strings or falls back to current month
func parseOrCurrentMonth(startStr, endStr string) (start, end time.Time) {
	now := time.Now()

	if startStr != "" {
		t, err := time.Parse("2006-01-02", startStr)
		if err == nil {
			start = t
		} else {
			t, err = time.Parse(time.RFC3339, startStr)
			if err == nil {
				start = t
			}
		}
	}
	if start.IsZero() {
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	}

	if endStr != "" {
		t, err := time.Parse("2006-01-02", endStr)
		if err == nil {
			end = t.Add(24*time.Hour - time.Nanosecond)
		} else {
			t, err = time.Parse(time.RFC3339, endStr)
			if err == nil {
				end = t
			}
		}
	}
	if end.IsZero() {
		end = start.AddDate(0, 1, 0).Add(-time.Nanosecond)
	}

	return
}

// percentChange returns the % change from prev to current, or nil if prev is 0
func percentChange(prev, curr float64) interface{} {
	if prev == 0 {
		if curr == 0 {
			return 0.0
		}
		return nil // can't compute % from 0 base
	}
	return ((curr - prev) / prev) * 100
}
