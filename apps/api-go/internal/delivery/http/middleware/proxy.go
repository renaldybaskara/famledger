package middleware

import "github.com/gin-gonic/gin"

// ForwardedProto rewrites the request scheme to "https" when the
// X-Forwarded-Proto header is set by a trusted upstream proxy (ngrok, Caddy).
// Without this, Go sees all traffic as http because TLS is terminated at the proxy.
func ForwardedProto() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetHeader("X-Forwarded-Proto") == "https" {
			c.Request.URL.Scheme = "https"
			c.Request.URL.Host = c.Request.Host
		}
		c.Next()
	}
}
