package middleware

import (
	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// TierGate blocks access unless the user has an active Pro subscription.
// Must be placed after JWTAuth so currentUserID is already set in context.
func TierGate(subUC domainuc.SubscriptionUseCase) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := c.Get("currentUserID")
		if !ok {
			httputil.Unauthorized(c, "Unauthorized")
			c.Abort()
			return
		}
		if !subUC.IsProActive(c.Request.Context(), uid.(uuid.UUID)) {
			httputil.Forbidden(c, "Fitur ini membutuhkan paket Pro. Upgrade di Pengaturan → Langganan.")
			c.Abort()
			return
		}
		c.Next()
	}
}
