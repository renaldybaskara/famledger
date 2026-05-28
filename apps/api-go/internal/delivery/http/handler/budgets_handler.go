package handler

import (
	"net/http"
	"time"

	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type BudgetsHandler struct {
	uc domainuc.BudgetUseCase
}

func NewBudgetsHandler(uc domainuc.BudgetUseCase) *BudgetsHandler {
	return &BudgetsHandler{uc: uc}
}

type createBudgetRequest struct {
	Name       string   `json:"name" binding:"required"`
	Amount     float64  `json:"amount" binding:"required,gt=0"`
	CategoryID *string  `json:"categoryId"`
	Period     string   `json:"period" binding:"required,oneof=monthly weekly yearly custom"`
	StartDate  string   `json:"startDate" binding:"required"`
	EndDate    *string  `json:"endDate"`
	CarryOver  *bool    `json:"carryOver"`
	AlertAt80  *bool    `json:"alertAt80"`
	AlertAt100 *bool    `json:"alertAt100"`
	AlertAt120 *bool    `json:"alertAt120"`
}

type updateBudgetRequest struct {
	Name       *string  `json:"name"`
	Amount     *float64 `json:"amount"`
	CategoryID *string  `json:"categoryId"`
	Period     *string  `json:"period"`
	StartDate  *string  `json:"startDate"`
	EndDate    *string  `json:"endDate"`
}

// GET /api/budgets
func (h *BudgetsHandler) FindAll(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	budgets, err := h.uc.FindAll(c.Request.Context(), userID)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, budgets)
}

// POST /api/budgets
func (h *BudgetsHandler) Create(c *gin.Context) {
	var req createBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		startDate, err = time.Parse(time.RFC3339, req.StartDate)
		if err != nil {
			httputil.BadRequest(c, "Invalid startDate format")
			return
		}
	}

	in := domainuc.CreateBudgetInput{
		Name:       req.Name,
		Amount:     req.Amount,
		Period:     req.Period,
		StartDate:  startDate,
		CarryOver:  req.CarryOver,
		AlertAt80:  req.AlertAt80,
		AlertAt100: req.AlertAt100,
		AlertAt120: req.AlertAt120,
	}
	if req.CategoryID != nil {
		if id, err := uuid.Parse(*req.CategoryID); err == nil {
			in.CategoryID = &id
		}
	}
	if req.EndDate != nil {
		t, err := time.Parse("2006-01-02", *req.EndDate)
		if err == nil {
			in.EndDate = &t
		}
	}

	userID := c.MustGet("currentUserID").(uuid.UUID)
	budget, err := h.uc.Create(c.Request.Context(), userID, in)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	c.JSON(http.StatusCreated, budget)
}

// PATCH /api/budgets/:id
func (h *BudgetsHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.BadRequest(c, "Invalid budget ID")
		return
	}

	var req updateBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	in := domainuc.UpdateBudgetInput{
		Name:   req.Name,
		Amount: req.Amount,
		Period: req.Period,
	}
	if req.CategoryID != nil {
		if uid, err := uuid.Parse(*req.CategoryID); err == nil {
			in.CategoryID = &uid
		}
	}
	if req.StartDate != nil {
		t, _ := time.Parse("2006-01-02", *req.StartDate)
		in.StartDate = &t
	}
	if req.EndDate != nil {
		t, _ := time.Parse("2006-01-02", *req.EndDate)
		in.EndDate = &t
	}

	userID := c.MustGet("currentUserID").(uuid.UUID)
	budget, err := h.uc.Update(c.Request.Context(), userID, id, in)
	if err != nil {
		if err.Error() == "budget not found" {
			httputil.NotFound(c, "Budget not found")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, budget)
}

// DELETE /api/budgets/:id
func (h *BudgetsHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.BadRequest(c, "Invalid budget ID")
		return
	}

	userID := c.MustGet("currentUserID").(uuid.UUID)
	if err := h.uc.Delete(c.Request.Context(), userID, id); err != nil {
		if err.Error() == "budget not found" {
			httputil.NotFound(c, "Budget not found")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Budget deleted successfully"})
}

// GET /api/budgets/subscriptions
func (h *BudgetsHandler) FindSubscriptions(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	subs, err := h.uc.FindSubscriptions(c.Request.Context(), userID)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, subs)
}

