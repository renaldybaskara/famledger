package middleware

import (
	"strings"

	"github.com/fintrackr/api/internal/domain/repository"
	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func JWTAuth(jwtSecret string, userRepo repository.UserRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			httputil.Unauthorized(c, "Unauthorized")
			c.Abort()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims := jwt.MapClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			httputil.Unauthorized(c, "Unauthorized")
			c.Abort()
			return
		}

		subStr, ok := claims["sub"].(string)
		if !ok {
			httputil.Unauthorized(c, "Unauthorized")
			c.Abort()
			return
		}

		userID, err := uuid.Parse(subStr)
		if err != nil {
			httputil.Unauthorized(c, "Unauthorized")
			c.Abort()
			return
		}

		user, err := userRepo.FindByID(c.Request.Context(), userID)
		if err != nil || user == nil {
			httputil.Unauthorized(c, "Unauthorized")
			c.Abort()
			return
		}

		c.Set("currentUser", user)
		c.Set("currentUserID", userID)
		c.Next()
	}
}

