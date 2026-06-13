package handler

import (
	"net/http"
	"strconv"

	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/fintrackr/api/internal/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// EmailMessageHandler exposes REST endpoints to browse parsed email messages.
type EmailMessageHandler struct {
	msgRepo   domainrepo.EmailMessageRepository
	importSvc *usecase.EmailImportService
}

func NewEmailMessageHandler(
	msgRepo domainrepo.EmailMessageRepository,
	importSvc *usecase.EmailImportService,
) *EmailMessageHandler {
	return &EmailMessageHandler{
		msgRepo:   msgRepo,
		importSvc: importSvc,
	}
}

// GET /api/email-messages
// Query params: integrationId, status, page, limit
func (h *EmailMessageHandler) List(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)

	q := domainrepo.ListEmailMessagesQuery{
		ParseStatus: c.Query("status"),
		Page:        1,
		Limit:       20,
	}

	if p := c.Query("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			q.Page = v
		}
	}
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 100 {
			q.Limit = v
		}
	}
	if id := c.Query("integrationId"); id != "" {
		if uid, err := uuid.Parse(id); err == nil {
			q.IntegrationID = &uid
		}
	}
	if v := c.Query("aiUsed"); v != "" {
		b := v == "true"
		q.AIUsed = &b
	}

	msgs, total, err := h.msgRepo.ListByUser(c.Request.Context(), userID, q)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}

	httputil.OK(c, gin.H{
		"data":  msgs,
		"total": total,
		"page":  q.Page,
		"limit": q.Limit,
	})
}

// GET /api/email-messages/:id
func (h *EmailMessageHandler) GetOne(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "invalid message id")
		return
	}

	msg, err := h.msgRepo.FindByID(c.Request.Context(), userID, id)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	if msg == nil {
		httputil.NotFound(c, "email message not found")
		return
	}

	httputil.OK(c, msg)
}

// POST /api/email-messages/:id/reprocess
// Forces re-parsing and re-import attempt for a failed/skipped message.
func (h *EmailMessageHandler) Reprocess(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "invalid message id")
		return
	}

	msg, err := h.msgRepo.FindByID(c.Request.Context(), userID, id)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	if msg == nil {
		httputil.NotFound(c, "email message not found")
		return
	}

	// Only allow reprocessing failed/skipped/pending messages.
	if msg.ParseStatus == "imported" {
		c.JSON(http.StatusConflict, gin.H{"error": "message has already been imported"})
		return
	}

	// Reset to pending so ProcessMessage can re-run.
	if err := h.msgRepo.UpdateStatus(c.Request.Context(), id, map[string]interface{}{
		"parse_status": "pending",
		"parse_error":  nil,
		"skip_reason":  nil,
	}); err != nil {
		httputil.InternalError(c, err)
		return
	}
	msg.ParseStatus = "pending"
	msg.ParseError = nil
	msg.SkipReason = nil

	if err := h.importSvc.ProcessMessage(c.Request.Context(), msg); err != nil {
		httputil.InternalError(c, err)
		return
	}

	// Re-fetch to return the updated record.
	updated, _ := h.msgRepo.FindByID(c.Request.Context(), userID, id)
	httputil.OK(c, updated)
}

// DELETE /api/email-messages/:id
// Removes an email message record (does NOT delete the linked transaction).
func (h *EmailMessageHandler) Delete(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "invalid message id")
		return
	}

	msg, err := h.msgRepo.FindByID(c.Request.Context(), userID, id)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	if msg == nil {
		httputil.NotFound(c, "email message not found")
		return
	}

	// Soft-delete by setting status to "deleted".
	if err := h.msgRepo.UpdateStatus(c.Request.Context(), id, map[string]interface{}{
		"parse_status": "deleted",
	}); err != nil {
		httputil.InternalError(c, err)
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
