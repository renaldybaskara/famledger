package handler

import (
	"crypto/subtle"
	"encoding/json"
	"io"
	"net/http"

	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	"github.com/fintrackr/api/internal/domain/entity"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SubscriptionHandler struct {
	uc            domainuc.SubscriptionUseCase
	webhookSecret string
}

func NewSubscriptionHandler(uc domainuc.SubscriptionUseCase, webhookSecret string) *SubscriptionHandler {
	return &SubscriptionHandler{uc: uc, webhookSecret: webhookSecret}
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

// POST /api/subscription/cancel
func (h *SubscriptionHandler) Cancel(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	if err := h.uc.Cancel(c.Request.Context(), userID); err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Langganan telah dibatalkan"})
}

// POST /api/subscription/midtrans/create-payment  [auth]
func (h *SubscriptionHandler) CreateMidtransPayment(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	user := c.MustGet("currentUser").(*entity.User)

	var req struct {
		Plan   string `json:"plan" binding:"required"`
		Period string `json:"period" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	result, err := h.uc.CreateMidtransPayment(c.Request.Context(), userID, req.Plan, req.Period, user.Email, user.Name)
	if err != nil {
		if err.Error() == "web payment not configured" {
			httputil.BadRequest(c, "Web payment is not configured")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, result)
}

// POST /api/subscription/midtrans/confirm  [auth]
// Called by the frontend after Snap's onSuccess to activate Pro without waiting for a webhook.
func (h *SubscriptionHandler) ConfirmMidtransPayment(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	if err := h.uc.ConfirmMidtransPayment(c.Request.Context(), userID); err != nil {
		if err.Error() == "web payment not configured" {
			httputil.BadRequest(c, "Web payment is not configured")
			return
		}
		httputil.BadRequest(c, err.Error())
		return
	}
	httputil.OK(c, gin.H{"message": "Langganan Pro aktif"})
}

// POST /api/webhooks/midtrans — public, no JWT
func (h *SubscriptionHandler) MidtransWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	var payload domainuc.MidtransWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	if err := h.uc.HandleMidtransWebhook(c.Request.Context(), payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusOK)
}

// POST /api/webhooks/revenuecat — public, no JWT
func (h *SubscriptionHandler) RevenueCatWebhook(c *gin.Context) {
	if h.webhookSecret == "" {
		c.Status(http.StatusServiceUnavailable)
		return
	}
	auth := c.GetHeader("Authorization")
	if subtle.ConstantTimeCompare([]byte(auth), []byte(h.webhookSecret)) != 1 {
		c.Status(http.StatusUnauthorized)
		return
	}

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
	if err := h.uc.HandleRevenueCatWebhook(c.Request.Context(), payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.Status(http.StatusOK)
}
