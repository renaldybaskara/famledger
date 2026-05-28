package handler

import (
	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/gin-gonic/gin"
)

type SettingsHandler struct {
	uc domainuc.SettingsUseCase
}

func NewSettingsHandler(uc domainuc.SettingsUseCase) *SettingsHandler {
	return &SettingsHandler{uc: uc}
}

// GET /api/settings/smtp
func (h *SettingsHandler) GetSMTP(c *gin.Context) {
	out, err := h.uc.GetSMTPSettings(c.Request.Context())
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, out)
}

// PUT /api/settings/smtp
func (h *SettingsHandler) SaveSMTP(c *gin.Context) {
	var req struct {
		Host    string `json:"host"`
		Port    string `json:"port"`
		User    string `json:"user"`
		Pass    string `json:"pass"`
		From    string `json:"from"`
		Enabled bool   `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	if err := h.uc.SaveSMTPSettings(c.Request.Context(), domainuc.SMTPSettingsInput{
		Host:    req.Host,
		Port:    req.Port,
		User:    req.User,
		Pass:    req.Pass,
		From:    req.From,
		Enabled: req.Enabled,
	}); err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "SMTP settings saved"})
}

// POST /api/settings/smtp/test
func (h *SettingsHandler) TestSMTP(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	if err := h.uc.TestSMTP(c.Request.Context(), req.Email); err != nil {
		httputil.BadRequest(c, "Gagal mengirim email test: "+err.Error())
		return
	}
	httputil.OK(c, gin.H{"message": "Email test terkirim ke " + req.Email})
}
