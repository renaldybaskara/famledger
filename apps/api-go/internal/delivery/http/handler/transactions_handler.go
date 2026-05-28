package handler

import (
	"net/http"
	"strconv"
	"time"

	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TransactionsHandler struct {
	uc domainuc.TransactionUseCase
}

func NewTransactionsHandler(uc domainuc.TransactionUseCase) *TransactionsHandler {
	return &TransactionsHandler{uc: uc}
}

type createTransactionRequest struct {
	Type           string   `json:"type" binding:"required,oneof=income expense transfer"`
	Amount         float64  `json:"amount" binding:"required,gt=0"`
	Date           string   `json:"date" binding:"required"`
	CategoryID     *string  `json:"categoryId"`
	AccountID      *string  `json:"accountId"`
	Description    *string  `json:"description"`
	Merchant       *string  `json:"merchant"`
	Note           *string  `json:"note"`
	Currency       *string  `json:"currency"`
	IdempotencyKey *string  `json:"idempotencyKey"`
}

type updateTransactionRequest struct {
	Type        *string  `json:"type"`
	Amount      *float64 `json:"amount"`
	Date        *string  `json:"date"`
	CategoryID  *string  `json:"categoryId"`
	AccountID   *string  `json:"accountId"`
	Description *string  `json:"description"`
	Merchant    *string  `json:"merchant"`
	Note        *string  `json:"note"`
}

// GET /api/transactions
func (h *TransactionsHandler) FindAll(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	q := domainrepo.ListTransactionsQuery{
		Page:   page,
		Limit:  limit,
		Type:   c.Query("type"),
		Search: c.Query("search"),
	}

	if s := c.Query("startDate"); s != "" {
		t, err := time.Parse(time.RFC3339, s)
		if err != nil {
			t, _ = time.Parse("2006-01-02", s)
		}
		q.StartDate = &t
	}
	if s := c.Query("endDate"); s != "" {
		t, err := time.Parse(time.RFC3339, s)
		if err != nil {
			t, _ = time.Parse("2006-01-02", s)
		}
		q.EndDate = &t
	}
	if s := c.Query("categoryId"); s != "" {
		if id, err := uuid.Parse(s); err == nil {
			q.CategoryID = &id
		}
	}
	if s := c.Query("accountId"); s != "" {
		if id, err := uuid.Parse(s); err == nil {
			q.AccountID = &id
		}
	}

	result, err := h.uc.FindAll(c.Request.Context(), userID, q)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, result)
}

// GET /api/transactions/:id
func (h *TransactionsHandler) FindOne(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.BadRequest(c, "Invalid transaction ID")
		return
	}

	userID := c.MustGet("currentUserID").(uuid.UUID)
	tx, err := h.uc.FindByID(c.Request.Context(), userID, id)
	if err != nil {
		httputil.NotFound(c, "Transaction not found")
		return
	}
	httputil.OK(c, tx)
}

// POST /api/transactions
func (h *TransactionsHandler) Create(c *gin.Context) {
	var req createTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	date, err := time.Parse(time.RFC3339, req.Date)
	if err != nil {
		date, err = time.Parse("2006-01-02", req.Date)
		if err != nil {
			httputil.BadRequest(c, "Invalid date format. Use ISO 8601 (e.g. 2025-01-15T10:00:00Z or 2025-01-15)")
			return
		}
	}

	in := domainuc.CreateTransactionInput{
		Type:        req.Type,
		Amount:      req.Amount,
		Date:        date,
		Description: req.Description,
		Merchant:    req.Merchant,
		Note:        req.Note,
		Currency:    req.Currency,
	}
	if req.CategoryID != nil {
		if id, err := uuid.Parse(*req.CategoryID); err == nil {
			in.CategoryID = &id
		}
	}
	if req.AccountID != nil {
		if id, err := uuid.Parse(*req.AccountID); err == nil {
			in.AccountID = &id
		}
	}
	if req.IdempotencyKey != nil {
		in.IdempotencyKey = req.IdempotencyKey
	}

	userID := c.MustGet("currentUserID").(uuid.UUID)
	tx, err := h.uc.Create(c.Request.Context(), userID, in)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	c.JSON(http.StatusCreated, tx)
}

// PATCH /api/transactions/:id
func (h *TransactionsHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.BadRequest(c, "Invalid transaction ID")
		return
	}

	var req updateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	in := domainuc.UpdateTransactionInput{
		Type:        req.Type,
		Amount:      req.Amount,
		Description: req.Description,
		Merchant:    req.Merchant,
		Note:        req.Note,
	}
	if req.Date != nil {
		t, err := time.Parse(time.RFC3339, *req.Date)
		if err != nil {
			t, _ = time.Parse("2006-01-02", *req.Date)
		}
		in.Date = &t
	}
	if req.CategoryID != nil {
		if id, err := uuid.Parse(*req.CategoryID); err == nil {
			in.CategoryID = &id
		}
	}
	if req.AccountID != nil {
		if id, err := uuid.Parse(*req.AccountID); err == nil {
			in.AccountID = &id
		}
	}

	userID := c.MustGet("currentUserID").(uuid.UUID)
	tx, err := h.uc.Update(c.Request.Context(), userID, id, in)
	if err != nil {
		if err.Error() == "transaction not found" {
			httputil.NotFound(c, "Transaction not found")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, tx)
}

// DELETE /api/transactions/:id
func (h *TransactionsHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.BadRequest(c, "Invalid transaction ID")
		return
	}

	userID := c.MustGet("currentUserID").(uuid.UUID)
	if err := h.uc.Delete(c.Request.Context(), userID, id); err != nil {
		if err.Error() == "transaction not found" {
			httputil.NotFound(c, "Transaction not found")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Transaction deleted successfully"})
}

