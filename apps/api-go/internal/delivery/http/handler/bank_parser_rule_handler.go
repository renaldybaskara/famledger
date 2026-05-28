package handler

import (
	"net/http"
	"strconv"

	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/gin-gonic/gin"
)

// BankParserRuleHandler exposes CRUD endpoints for bank email parser rules.
// These rules are global (apply to all users) and managed by an admin.
type BankParserRuleHandler struct {
	repo domainrepo.BankParserRuleRepository
}

func NewBankParserRuleHandler(repo domainrepo.BankParserRuleRepository) *BankParserRuleHandler {
	return &BankParserRuleHandler{repo: repo}
}

// GET /api/settings/parser-rules
// Returns all rules (including inactive) for the admin UI.
func (h *BankParserRuleHandler) List(c *gin.Context) {
	rules, err := h.repo.FindAll(c.Request.Context())
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, rules)
}

// GET /api/settings/parser-rules/active
// Returns only active rules — used by the parser engine (and for display purposes).
func (h *BankParserRuleHandler) ListActive(c *gin.Context) {
	rules, err := h.repo.FindAllActive(c.Request.Context())
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, rules)
}

type createParserRuleRequest struct {
	Name                string `json:"name"               binding:"required,min=1,max=100"`
	FromPatterns        string `json:"fromPatterns"       binding:"required"`
	SubjectPatterns     string `json:"subjectPatterns"`
	ExpenseKeywords     string `json:"expenseKeywords"`
	IncomeKeywords      string `json:"incomeKeywords"`
	BodyConfirmKeywords string `json:"bodyConfirmKeywords"`
	AmountRegex         string `json:"amountRegex"`
	DefaultType         string `json:"defaultType"`
	Priority            int    `json:"priority"`
	Note                string `json:"note"`
}

// POST /api/settings/parser-rules
func (h *BankParserRuleHandler) Create(c *gin.Context) {
	var req createParserRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.BadRequest(c, err.Error())
		return
	}

	// Check duplicate name
	existing, err := h.repo.FindByName(c.Request.Context(), req.Name)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "a rule with this name already exists"})
		return
	}

	defaultType := req.DefaultType
	if defaultType != "income" && defaultType != "expense" && defaultType != "transfer" {
		defaultType = "expense"
	}

	rule := &entity.BankParserRule{
		Name:                req.Name,
		FromPatterns:        req.FromPatterns,
		SubjectPatterns:     req.SubjectPatterns,
		ExpenseKeywords:     req.ExpenseKeywords,
		IncomeKeywords:      req.IncomeKeywords,
		BodyConfirmKeywords: req.BodyConfirmKeywords,
		AmountRegex:         req.AmountRegex,
		DefaultType:         defaultType,
		Priority:            req.Priority,
		IsActive:            true,
		IsGlobal:            true,
		Note:                req.Note,
	}

	if err := h.repo.Create(c.Request.Context(), rule); err != nil {
		httputil.InternalError(c, err)
		return
	}

	c.JSON(http.StatusCreated, rule)
}

// PATCH /api/settings/parser-rules/:id
func (h *BankParserRuleHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		httputil.BadRequest(c, "invalid rule id")
		return
	}

	existing, err := h.repo.FindByID(c.Request.Context(), uint(id))
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	if existing == nil {
		httputil.NotFound(c, "parser rule not found")
		return
	}

	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		httputil.BadRequest(c, err.Error())
		return
	}

	// Whitelist updatable fields
	allowed := map[string]bool{
		"name": true, "from_patterns": true, "subject_patterns": true,
		"expense_keywords": true, "income_keywords": true,
		"body_confirm_keywords": true, "amount_regex": true,
		"default_type": true, "priority": true,
		"is_active": true, "note": true,
	}
	updates := make(map[string]interface{})
	for k, v := range body {
		// Accept both camelCase (from frontend) and snake_case
		snake := camelToSnake(k)
		if allowed[snake] {
			updates[snake] = v
		} else if allowed[k] {
			updates[k] = v
		}
	}

	if len(updates) == 0 {
		httputil.BadRequest(c, "no valid fields to update")
		return
	}

	updated, err := h.repo.Update(c.Request.Context(), uint(id), updates)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, updated)
}

// DELETE /api/settings/parser-rules/:id
func (h *BankParserRuleHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		httputil.BadRequest(c, "invalid rule id")
		return
	}

	existing, err := h.repo.FindByID(c.Request.Context(), uint(id))
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	if existing == nil {
		httputil.NotFound(c, "parser rule not found")
		return
	}

	if err := h.repo.Delete(c.Request.Context(), uint(id)); err != nil {
		httputil.InternalError(c, err)
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// PATCH /api/settings/parser-rules/:id/toggle
// Quickly enable or disable a rule without a full PATCH.
func (h *BankParserRuleHandler) Toggle(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		httputil.BadRequest(c, "invalid rule id")
		return
	}

	existing, err := h.repo.FindByID(c.Request.Context(), uint(id))
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	if existing == nil {
		httputil.NotFound(c, "parser rule not found")
		return
	}

	updated, err := h.repo.Update(c.Request.Context(), uint(id), map[string]interface{}{
		"is_active": !existing.IsActive,
	})
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, updated)
}

// ── helper ────────────────────────────────────────────────────────────────────

// camelToSnake converts "fromPatterns" → "from_patterns" for GORM updates.
func camelToSnake(s string) string {
	var out []byte
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if ch >= 'A' && ch <= 'Z' {
			if i > 0 {
				out = append(out, '_')
			}
			out = append(out, ch+32)
		} else {
			out = append(out, ch)
		}
	}
	return string(out)
}
