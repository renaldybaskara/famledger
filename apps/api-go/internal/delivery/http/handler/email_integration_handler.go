package handler

import (
	"net/http"

	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/fintrackr/api/internal/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type EmailIntegrationHandler struct {
	uc domainuc.EmailIntegrationUseCase
}

func NewEmailIntegrationHandler(uc domainuc.EmailIntegrationUseCase) *EmailIntegrationHandler {
	return &EmailIntegrationHandler{uc: uc}
}

// GET /api/email-integrations
func (h *EmailIntegrationHandler) List(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)

	integrations, err := h.uc.List(c.Request.Context(), userID)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, integrations)
}

// POST /api/email-integrations/imap
func (h *EmailIntegrationHandler) ConnectIMAP(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)

	var req struct {
		Email    string `json:"email" binding:"required,email"`
		ImapHost string `json:"imapHost" binding:"required"`
		ImapPort int    `json:"imapPort" binding:"required"`
		ImapUser string `json:"imapUser" binding:"required"`
		ImapPass string `json:"imapPass" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	integration, err := h.uc.ConnectIMAP(c.Request.Context(), userID, domainuc.ConnectIMAPInput{
		Email:    req.Email,
		ImapHost: req.ImapHost,
		ImapPort: req.ImapPort,
		ImapUser: req.ImapUser,
		ImapPass: req.ImapPass,
	})
	if err != nil {
		switch err {
		case usecase.ErrEmailAlreadyConnected:
			httputil.Conflict(c, "This email is already connected")
		case usecase.ErrIMAPConnectionFailed:
			httputil.BadRequest(c, "Failed to connect to IMAP server — check host, port, and credentials")
		default:
			httputil.InternalError(c, err)
		}
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": integration})
}

// GET /api/email-integrations/gmail/auth
func (h *EmailIntegrationHandler) GmailAuthURL(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)

	url, err := h.uc.GetGmailAuthURL(c.Request.Context(), userID)
	if err != nil {
		if err == usecase.ErrGmailNotConfigured {
			httputil.BadRequest(c, "Google OAuth is not configured on this server")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"url": url})
}

// GET /api/email-integrations/gmail/callback
func (h *EmailIntegrationHandler) GmailCallback(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)

	code := c.Query("code")
	if code == "" {
		httputil.BadRequest(c, "Missing OAuth code")
		return
	}

	integration, err := h.uc.CompleteGmailOAuth(c.Request.Context(), userID, code)
	if err != nil {
		if err == usecase.ErrGmailNotConfigured {
			httputil.BadRequest(c, "Google OAuth is not configured")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"data": integration, "message": "Gmail connected successfully"})
}

// DELETE /api/email-integrations/:id
func (h *EmailIntegrationHandler) Disconnect(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid integration ID")
		return
	}

	if err := h.uc.Disconnect(c.Request.Context(), id, userID); err != nil {
		if err == usecase.ErrEmailIntegrationNotFound {
			httputil.NotFound(c, "Integration not found")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Email integration disconnected"})
}

// PATCH /api/email-integrations/:id/toggle
func (h *EmailIntegrationHandler) Toggle(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid integration ID")
		return
	}

	var req struct {
		IsActive bool `json:"isActive"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	if err := h.uc.SetActive(c.Request.Context(), id, userID, req.IsActive); err != nil {
		if err == usecase.ErrEmailIntegrationNotFound {
			httputil.NotFound(c, "Integration not found")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Integration updated"})
}

// POST /api/email-integrations/:id/sync
func (h *EmailIntegrationHandler) Sync(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid integration ID")
		return
	}

	if err := h.uc.Sync(c.Request.Context(), id, userID); err != nil {
		if err == usecase.ErrEmailIntegrationNotFound {
			httputil.NotFound(c, "Integration not found")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Sync initiated"})
}
