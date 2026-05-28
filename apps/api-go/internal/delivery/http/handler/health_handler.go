package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type HealthHandler struct {
	version string
	env     string
}

func NewHealthHandler(version, env string) *HealthHandler {
	return &HealthHandler{version: version, env: env}
}

func (h *HealthHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":      "ok",
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
		"version":     h.version,
		"environment": h.env,
	})
}
