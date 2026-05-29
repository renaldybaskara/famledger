package handler

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"

	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	"github.com/fintrackr/api/internal/domain/entity"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/fintrackr/api/internal/infrastructure/tokenstore"
	"github.com/fintrackr/api/internal/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type AuthHandler struct {
	uc           domainuc.AuthUseCase
	oauth2Config *oauth2.Config
	tokenStore   tokenStore
}

// tokenStore is the minimal interface needed from tokenstore.Store.
type tokenStore interface {
	Save(ctx context.Context, pair tokenstore.TokenPair) (string, error)
	Exchange(ctx context.Context, code string) (*tokenstore.TokenPair, error)
}

func NewAuthHandler(uc domainuc.AuthUseCase, clientID, clientSecret, callbackURL string, ts tokenStore) *AuthHandler {
	var oauthCfg *oauth2.Config
	if clientID != "" {
		oauthCfg = &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  callbackURL,
			Scopes:       []string{"email", "profile"},
			Endpoint:     google.Endpoint,
		}
	}
	return &AuthHandler{uc: uc, oauth2Config: oauthCfg, tokenStore: ts}
}

type registerRequest struct {
	Name     string `json:"name" binding:"required,min=2,max=100"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8,max=128"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

type logoutRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

// POST /api/auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	out, err := h.uc.Register(c.Request.Context(), domainuc.RegisterInput{
		Name:     req.Name,
		Email:    req.Email,
		Password: req.Password,
	})
	if err != nil {
		if err == usecase.ErrUserAlreadyExists {
			httputil.Conflict(c, "Email already registered")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	c.JSON(http.StatusCreated, out)
}

// POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	out, err := h.uc.Login(c.Request.Context(), domainuc.LoginInput{
		Email:    req.Email,
		Password: req.Password,
	})
	if err != nil {
		if err == usecase.ErrInvalidCredentials {
			httputil.Unauthorized(c, "Invalid email or password")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, out)
}

// POST /api/auth/refresh
func (h *AuthHandler) Refresh(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	userID, err := extractSubFromToken(req.RefreshToken)
	if err != nil {
		httputil.Unauthorized(c, "Invalid refresh token")
		return
	}

	out, err := h.uc.RefreshTokens(c.Request.Context(), userID, req.RefreshToken)
	if err != nil {
		httputil.Unauthorized(c, "Invalid or expired refresh token")
		return
	}
	httputil.OK(c, out)
}

// POST /api/auth/logout
func (h *AuthHandler) Logout(c *gin.Context) {
	var req logoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	userIDVal, exists := c.Get("currentUserID")
	if !exists {
		httputil.Unauthorized(c, "Unauthorized")
		return
	}
	userID := userIDVal.(uuid.UUID)

	if err := h.uc.Logout(c.Request.Context(), userID, req.RefreshToken); err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Logged out successfully"})
}

// GET /api/auth/me
func (h *AuthHandler) Me(c *gin.Context) {
	user, exists := c.Get("currentUser")
	if !exists {
		httputil.Unauthorized(c, "Unauthorized")
		return
	}
	httputil.OK(c, gin.H{"user": user.(*entity.User).Safe()})
}

// GET /api/auth/google
func (h *AuthHandler) GoogleLogin(c *gin.Context) {
	if h.oauth2Config == nil {
		httputil.BadRequest(c, "Google OAuth not configured")
		return
	}
	authURL := h.oauth2Config.AuthCodeURL("state", oauth2.AccessTypeOffline)
	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// GET /api/auth/google/callback
func (h *AuthHandler) GoogleCallback(c *gin.Context) {
	if h.oauth2Config == nil {
		c.Redirect(http.StatusTemporaryRedirect, "/?error=google_not_configured")
		return
	}

	code := c.Query("code")
	if code == "" {
		c.Redirect(http.StatusTemporaryRedirect, "/?error=missing_code")
		return
	}

	token, err := h.oauth2Config.Exchange(context.Background(), code)
	if err != nil {
		log.Printf("[GoogleCallback] token exchange failed: %v", err)
		c.Redirect(http.StatusTemporaryRedirect, "/?error=oauth_exchange_failed&detail="+url.QueryEscape(err.Error()))
		return
	}

	client := h.oauth2Config.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, "/?error=userinfo_failed")
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var googleUser struct {
		Sub     string `json:"sub"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.Unmarshal(body, &googleUser); err != nil {
		c.Redirect(http.StatusTemporaryRedirect, "/?error=userinfo_parse_failed")
		return
	}

	out, err := h.uc.GoogleLogin(c.Request.Context(), domainuc.GoogleUserInfo{
		Sub:     googleUser.Sub,
		Email:   googleUser.Email,
		Name:    googleUser.Name,
		Picture: googleUser.Picture,
	})
	if err != nil {
		c.Redirect(http.StatusTemporaryRedirect, "/?error=login_failed")
		return
	}

	// Store tokens in Redis, redirect only with a short one-time code.
	// Tokens never appear in the URL, browser history, or server logs.
	if h.tokenStore != nil {
		code, err := h.tokenStore.Save(c.Request.Context(), tokenstore.TokenPair{
			AccessToken:  out.AccessToken,
			RefreshToken: out.RefreshToken,
		})
		if err != nil {
			log.Printf("[GoogleCallback] tokenstore save error: %v", err)
			c.Redirect(http.StatusTemporaryRedirect, "/?error=server_error")
			return
		}
		c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("/auth/callback?code=%s", code))
		return
	}
	// Fallback if Redis not available — use fragment (tokens not sent to server)
	c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("/#t=%s&r=%s",
		out.AccessToken, out.RefreshToken))
}

// POST /api/auth/exchange — exchange one-time code for JWT tokens
func (h *AuthHandler) ExchangeCode(c *gin.Context) {
	var body struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httputil.ValidationError(c, err)
		return
	}
	if h.tokenStore == nil {
		httputil.BadRequest(c, "Token exchange not available")
		return
	}
	pair, err := h.tokenStore.Exchange(c.Request.Context(), body.Code)
	if err != nil {
		httputil.Unauthorized(c, "Invalid or expired code")
		return
	}
	httputil.OK(c, gin.H{
		"accessToken":  pair.AccessToken,
		"refreshToken": pair.RefreshToken,
	})
}

// GET /api/auth/google/configured — returns whether Google OAuth is set up on this server
func (h *AuthHandler) GoogleConfigured(c *gin.Context) {
	httputil.OK(c, gin.H{"configured": h.oauth2Config != nil})
}

// POST /api/auth/send-verification (protected)
func (h *AuthHandler) SendVerification(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	if err := h.uc.SendVerificationEmail(c.Request.Context(), userID); err != nil {
		if err == usecase.ErrEmailAlreadyVerified {
			httputil.BadRequest(c, "Email already verified")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Verification email sent"})
}

// POST /api/auth/verify-email
func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		var body struct {
			Token string `json:"token" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			httputil.ValidationError(c, err)
			return
		}
		token = body.Token
	}

	if err := h.uc.VerifyEmail(c.Request.Context(), token); err != nil {
		if err == usecase.ErrInvalidToken {
			httputil.BadRequest(c, "Invalid or expired verification token")
			return
		}
		if err == usecase.ErrEmailAlreadyVerified {
			httputil.BadRequest(c, "Email already verified")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Email verified successfully"})
}

// POST /api/auth/forgot-password
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var body struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httputil.ValidationError(c, err)
		return
	}
	// Always return success (don't reveal if email exists)
	_ = h.uc.ForgotPassword(c.Request.Context(), body.Email)
	httputil.OK(c, gin.H{"message": "If that email is registered, a reset link has been sent"})
}

// POST /api/auth/reset-password
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var body struct {
		Token       string `json:"token" binding:"required"`
		NewPassword string `json:"newPassword" binding:"required,min=8,max=128"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	if err := h.uc.ResetPassword(c.Request.Context(), body.Token, body.NewPassword); err != nil {
		if err == usecase.ErrInvalidToken {
			httputil.BadRequest(c, "Invalid or expired reset token")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Password reset successfully. Please log in with your new password."})
}

// POST /api/auth/change-password (protected)
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)

	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword" binding:"required,min=8,max=128"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	if err := h.uc.ChangePassword(c.Request.Context(), userID, body.CurrentPassword, body.NewPassword); err != nil {
		if err == usecase.ErrWrongPassword {
			httputil.BadRequest(c, "Current password is incorrect")
			return
		}
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Password changed successfully"})
}

// extractSubFromToken reads the sub claim from a JWT without signature verification
func extractSubFromToken(tokenStr string) (uuid.UUID, error) {
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return uuid.Nil, fmt.Errorf("invalid token format")
	}

	// Pad the base64url payload
	payload := parts[1]
	switch len(payload) % 4 {
	case 2:
		payload += "=="
	case 3:
		payload += "="
	}
	payload = strings.ReplaceAll(payload, "-", "+")
	payload = strings.ReplaceAll(payload, "_", "/")

	decoded, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return uuid.Nil, err
	}

	var claims struct {
		Sub string `json:"sub"`
	}
	if err := json.Unmarshal(decoded, &claims); err != nil {
		return uuid.Nil, err
	}

	return uuid.Parse(claims.Sub)
}

