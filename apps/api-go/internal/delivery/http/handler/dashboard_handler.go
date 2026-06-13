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
	wsUC domainuc.WorkspaceUseCase
}

func NewDashboardHandler(txUC domainuc.TransactionUseCase, wsUC domainuc.WorkspaceUseCase) *DashboardHandler {
	return &DashboardHandler{txUC: txUC, wsUC: wsUC}
}

// resolveUserIDs collects all user IDs for the requested scope:
//   - "includePersonal=true" (default) → include the requesting user
//   - "workspaceIds[]=<id>" → include all members of each workspace (membership verified)
//
// Returns deduplicated []uuid.UUID ready for *ByUserIDs queries.
func (h *DashboardHandler) resolveUserIDs(c *gin.Context, currentUserID uuid.UUID) []uuid.UUID {
	// Axios serializes arrays as workspaceIds[]=id1 (with brackets) — handle both forms.
	wsIDStrs := c.QueryArray("workspaceIds[]")
	if len(wsIDStrs) == 0 {
		wsIDStrs = c.QueryArray("workspaceIds")
	}
	includePersonal := c.DefaultQuery("includePersonal", "true") != "false"

	seen := make(map[uuid.UUID]struct{})
	var ids []uuid.UUID

	add := func(id uuid.UUID) {
		if _, ok := seen[id]; !ok {
			seen[id] = struct{}{}
			ids = append(ids, id)
		}
	}

	if includePersonal {
		add(currentUserID)
	}

	for _, idStr := range wsIDStrs {
		wsID, err := uuid.Parse(idStr)
		if err != nil {
			continue
		}
		memberIDs, err := h.wsUC.GetMemberUserIDsForScope(c.Request.Context(), wsID, currentUserID)
		if err != nil {
			continue // skip workspaces where user is not a member
		}
		for _, mid := range memberIDs {
			add(mid)
		}
	}

	// Fallback: always include at least the current user
	if len(ids) == 0 {
		ids = []uuid.UUID{currentUserID}
	}
	return ids
}

// GET /api/dashboard/summary
// Query params: startDate, endDate, workspaceIds[], includePersonal
func (h *DashboardHandler) Summary(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	start, end := parseOrCurrentMonth(c.Query("startDate"), c.Query("endDate"))
	userIDs := h.resolveUserIDs(c, userID)

	sum, err := h.txUC.GetSummaryByUserIDs(c.Request.Context(), userIDs, start, end)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}

	duration := end.Sub(start)
	prevEnd := start.Add(-time.Nanosecond)
	prevStart := prevEnd.Add(-duration)
	prevSum, err := h.txUC.GetSummaryByUserIDs(c.Request.Context(), userIDs, prevStart, prevEnd)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}

	httputil.OK(c, gin.H{
		"totalIncome": sum.Income, "totalExpense": sum.Expense,
		"totalTransfer": sum.Transfer, "netBalance": sum.Net,
		"transactionCount": sum.TransactionCount,
		"previousPeriod": gin.H{
			"totalIncome": prevSum.Income, "totalExpense": prevSum.Expense,
			"totalTransfer": prevSum.Transfer, "netBalance": prevSum.Net,
			"transactionCount": prevSum.TransactionCount,
		},
		"incomeChange":     percentChange(prevSum.Income, sum.Income),
		"expenseChange":    percentChange(prevSum.Expense, sum.Expense),
		"netBalanceChange": percentChange(prevSum.Net, sum.Net),
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
	userIDs := h.resolveUserIDs(c, userID)

	rows, err := h.txUC.GetCategoryBreakdownByUserIDs(c.Request.Context(), userIDs, txType, start, end)
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
	userIDs := h.resolveUserIDs(c, userID)

	rows, err := h.txUC.GetMonthlyTrendByUserIDs(c.Request.Context(), userIDs, months)
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

// wibLoc is Asia/Jakarta (UTC+7) — used for date-only string parsing so that
// "2026-05-25" means midnight WIB, not midnight UTC.
var wibLoc = func() *time.Location {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		return time.UTC
	}
	return loc
}()

// parseOrCurrentMonth parses date strings or falls back to current month.
// Date-only strings (YYYY-MM-DD) are interpreted in WIB (Asia/Jakarta) so that
// a filter for "25 May" covers the full Indonesian day, including email-imported
// transactions received in early-morning WIB hours that are stored near UTC midnight.
func parseOrCurrentMonth(startStr, endStr string) (start, end time.Time) {
	loc := wibLoc
	now := time.Now()

	if startStr != "" {
		t, err := time.ParseInLocation("2006-01-02", startStr, loc)
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
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
	}

	if endStr != "" {
		t, err := time.ParseInLocation("2006-01-02", endStr, loc)
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
