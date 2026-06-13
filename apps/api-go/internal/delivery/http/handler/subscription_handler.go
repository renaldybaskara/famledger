package handler

import (
	"encoding/json"
	"io"
	"net/http"

	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SubscriptionHandler struct {
	uc domainuc.SubscriptionUseCase
}

func NewSubscriptionHandler(uc domainuc.SubscriptionUseCase) *SubscriptionHandler {
	return &SubscriptionHandler{uc: uc}
}

// GET /api/subscription
func (h *SubscriptionHandler) GetStatus(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	sub, err := h.uc.GetStatus(c.Request.Context(), userID)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, sub)
}

// POST /api/subscription/checkout
func (h *SubscriptionHandler) Checkout(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	var req struct {
		Plan   string `json:"plan" binding:"required,oneof=pro"`
		Period string `json:"period" binding:"required,oneof=monthly annual"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}
	out, err := h.uc.Checkout(c.Request.Context(), userID, domainuc.CheckoutInput{
		Plan:   req.Plan,
		Period: req.Period,
	})
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": out})
}

// POST /api/subscription/cancel
func (h *SubscriptionHandler) Cancel(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	if err := h.uc.Cancel(c.Request.Context(), userID); err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Langganan telah dibatalkan"})
}

// GET /api/subscription/history
func (h *SubscriptionHandler) History(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	orders, err := h.uc.GetHistory(c.Request.Context(), userID)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, orders)
}

// POST /api/webhooks/midtrans — public, no JWT
func (h *SubscriptionHandler) MidtransWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	if err := h.uc.HandleWebhook(c.Request.Context(), payload); err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	c.Status(http.StatusOK)
}
