package handler

import (
	"net/http"

	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AccountsHandler struct {
	uc domainuc.AccountUseCase
}

func NewAccountsHandler(uc domainuc.AccountUseCase) *AccountsHandler {
	return &AccountsHandler{uc: uc}
}

type createAccountRequest struct {
	Name          string   `json:"name" binding:"required"`
	Type          string   `json:"type" binding:"required,oneof=bank credit investment"`
	BankCode      *string  `json:"bankCode"`
	AccountNumber *string  `json:"accountNumber"`
	Balance       *float64 `json:"balance"`
	Currency      *string  `json:"currency"`
	Color         *string  `json:"color"`
	Icon          *string  `json:"icon"`
}

type updateAccountRequest struct {
	Name          *string  `json:"name"`
	Type          *string  `json:"type"`
	BankCode      *string  `json:"bankCode"`
	AccountNumber *string  `json:"accountNumber"`
	Color         *string  `json:"color"`
	Icon          *string  `json:"icon"`
	IsDefault     *bool    `json:"isDefault"`
	Balance       *float64 `json:"balance"`
}

// GET /api/accounts
func (h *AccountsHandler) FindAll(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	accounts, err := h.uc.FindAll(c.Request.Context(), userID)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, accounts)
}

// POST /api/accounts
func (h *AccountsHandler) Create(c *gin.Context) {
	var req createAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	userID := c.MustGet("currentUserID").(uuid.UUID)
	account, err := h.uc.Create(c.Request.Context(), userID, domainuc.CreateAccountInput{
		Name:          req.Name,
		Type:          req.Type,
		BankCode:      req.BankCode,
		AccountNumber: req.AccountNumber,
		Balance:       req.Balance,
		Currency:      req.Currency,
		Color:         req.Color,
		Icon:          req.Icon,
	})
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	c.JSON(http.StatusCreated, account)
}

// PATCH /api/accounts/:id
func (h *AccountsHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.BadRequest(c, "Invalid account ID")
		return
	}

	var req updateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	userID := c.MustGet("currentUserID").(uuid.UUID)
	account, err := h.uc.Update(c.Request.Context(), userID, id, domainuc.UpdateAccountInput{
		Name:          req.Name,
		Type:          req.Type,
		BankCode:      req.BankCode,
		AccountNumber: req.AccountNumber,
		Color:         req.Color,
		Icon:          req.Icon,
		IsDefault:     req.IsDefault,
		Balance:       req.Balance,
	})
	if err != nil {
		if err.Error() == "account not found" {
			httputil.NotFound(c, "Account not found")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, account)
}

// DELETE /api/accounts/:id
func (h *AccountsHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.BadRequest(c, "Invalid account ID")
		return
	}

	userID := c.MustGet("currentUserID").(uuid.UUID)
	if err := h.uc.Delete(c.Request.Context(), userID, id); err != nil {
		if err.Error() == "account not found" {
			httputil.NotFound(c, "Account not found")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Account deleted successfully"})
}

