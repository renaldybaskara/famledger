package middleware

import (
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORS(appURL string) gin.HandlerFunc {
	origins := []string{
		"http://localhost",
		"http://localhost:3000",
		"http://localhost:8081",
	}
	// Add the configured APP_URL if not already covered
	for _, u := range strings.Split(appURL, ",") {
		u = strings.TrimSpace(u)
		if u != "" {
			origins = append(origins, u)
		}
	}

	return cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})
}
