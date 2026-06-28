package usecase

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var (
	ErrEmailIntegrationNotFound = errors.New("email integration not found")
	ErrEmailAlreadyConnected    = errors.New("this email is already connected")
	ErrGmailNotConfigured       = errors.New("Google OAuth is not configured")
	ErrIMAPConnectionFailed     = errors.New("failed to connect to IMAP server — check host, port, and credentials")
)

type emailIntegrationUseCase struct {
	repo           domainrepo.EmailIntegrationRepository
	googleClientID string
	googleSecret   string
	callbackURL    string
}

func NewEmailIntegrationUseCase(
	repo domainrepo.EmailIntegrationRepository,
	googleClientID, googleSecret, callbackURL string,
) domainuc.EmailIntegrationUseCase {
	return &emailIntegrationUseCase{
		repo:           repo,
		googleClientID: googleClientID,
		googleSecret:   googleSecret,
		callbackURL:    callbackURL,
	}
}

func (uc *emailIntegrationUseCase) List(ctx context.Context, userID uuid.UUID) ([]entity.EmailIntegration, error) {
	return uc.repo.FindByUserID(ctx, userID)
}

func (uc *emailIntegrationUseCase) ConnectIMAP(ctx context.Context, userID uuid.UUID, in domainuc.ConnectIMAPInput) (*entity.EmailIntegration, error) {
	// Check if already connected
	existing, err := uc.repo.FindByUserIDAndEmail(ctx, userID, in.Email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrEmailAlreadyConnected
	}

	// Test IMAP connection
	if err := testIMAPConnection(in.ImapHost, in.ImapPort); err != nil {
		return nil, ErrIMAPConnectionFailed
	}

	integration := &entity.EmailIntegration{
		ID:           uuid.New(),
		UserID:       userID,
		Email:        in.Email,
		Provider:     "imap",
		ImapHost:     &in.ImapHost,
		ImapPort:     &in.ImapPort,
		ImapUser:     &in.ImapUser,
		ImapPassword: &in.ImapPass,
		IsActive:     true,
	}

	if err := uc.repo.Create(ctx, integration); err != nil {
		return nil, err
	}

	// Mask password before returning
	integration.ImapPassword = nil
	return integration, nil
}

func (uc *emailIntegrationUseCase) GetGmailAuthURL(ctx context.Context, userID uuid.UUID) (string, error) {
	if uc.googleClientID == "" {
		return "", ErrGmailNotConfigured
	}

	cfg := uc.gmailOAuthConfig()
	state := fmt.Sprintf("gmail_connect_%s", userID.String())

	// Only force consent screen when no valid refresh token exists in DB.
	// Google only issues a refresh_token on first auth or when prompt=consent is set.
	opts := []oauth2.AuthCodeOption{oauth2.AccessTypeOffline}
	if !uc.hasValidGmailRefreshToken(ctx, userID) {
		opts = append(opts, oauth2.SetAuthURLParam("prompt", "consent"))
	}

	url := cfg.AuthCodeURL(state, opts...)
	return url, nil
}

func (uc *emailIntegrationUseCase) restoreIntegration(ctx context.Context, id uuid.UUID, updates map[string]interface{}) (*entity.EmailIntegration, error) {
	restored, err := uc.repo.Restore(ctx, id, updates)
	if err != nil {
		return nil, err
	}
	restored.AccessToken = nil
	restored.RefreshToken = nil
	return restored, nil
}

func (uc *emailIntegrationUseCase) hasValidGmailRefreshToken(ctx context.Context, userID uuid.UUID) bool {
	integrations, err := uc.repo.FindByUserID(ctx, userID)
	if err != nil {
		return false
	}
	for _, integ := range integrations {
		if integ.Provider == "gmail" && integ.RefreshToken != nil && *integ.RefreshToken != "" {
			return true
		}
	}
	return false
}

func (uc *emailIntegrationUseCase) CompleteGmailOAuth(ctx context.Context, userID uuid.UUID, code string) (*entity.EmailIntegration, error) {
	if uc.googleClientID == "" {
		return nil, ErrGmailNotConfigured
	}

	cfg := uc.gmailOAuthConfig()
	token, err := cfg.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange OAuth code: %w", err)
	}

	// Get Gmail address from Google
	client := cfg.Client(ctx, token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v3/userinfo")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var info struct {
		Email string `json:"email"`
	}
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, err
	}

	// Check if integration exists (including soft-deleted) — update or restore if so
	existing, err := uc.repo.FindAnyByUserIDAndEmail(ctx, userID, info.Email)
	if err != nil {
		return nil, err
	}

	accessToken := token.AccessToken
	refreshToken := token.RefreshToken

	if existing != nil {
		updates := map[string]interface{}{
			"access_token": accessToken,
			"is_active":    true,
		}
		if refreshToken != "" {
			updates["refresh_token"] = refreshToken
		}
		if !token.Expiry.IsZero() {
			updates["watch_expiration"] = token.Expiry
		}
		// Restore soft-deleted integration via Unscoped — keep last_sync_at so worker resumes from last sync point
		if existing.DeletedAt.Valid {
			updates["deleted_at"] = nil
			return uc.restoreIntegration(ctx, existing.ID, updates)
		}
		updated, err := uc.repo.Update(ctx, existing.ID, updates)
		if err != nil {
			return nil, err
		}
		updated.AccessToken = nil
		updated.RefreshToken = nil
		return updated, nil
	}

	var expiry *time.Time
	if !token.Expiry.IsZero() {
		e := token.Expiry
		expiry = &e
	}

	integration := &entity.EmailIntegration{
		ID:              uuid.New(),
		UserID:          userID,
		Email:           info.Email,
		Provider:        "gmail",
		AccessToken:     &accessToken,
		RefreshToken:    &refreshToken,
		WatchExpiration: expiry,
		IsActive:        true,
	}

	if err := uc.repo.Create(ctx, integration); err != nil {
		return nil, err
	}

	integration.AccessToken = nil
	integration.RefreshToken = nil
	return integration, nil
}

func (uc *emailIntegrationUseCase) Disconnect(ctx context.Context, integrationID, userID uuid.UUID) error {
	integration, err := uc.repo.FindByID(ctx, integrationID)
	if err != nil {
		return err
	}
	if integration == nil || integration.UserID != userID {
		return ErrEmailIntegrationNotFound
	}
	return uc.repo.Delete(ctx, integrationID)
}

func (uc *emailIntegrationUseCase) SetActive(ctx context.Context, integrationID, userID uuid.UUID, active bool) error {
	integration, err := uc.repo.FindByID(ctx, integrationID)
	if err != nil {
		return err
	}
	if integration == nil || integration.UserID != userID {
		return ErrEmailIntegrationNotFound
	}
	_, err = uc.repo.Update(ctx, integrationID, map[string]interface{}{"is_active": active})
	return err
}

func (uc *emailIntegrationUseCase) Sync(ctx context.Context, integrationID, userID uuid.UUID, sinceDate *time.Time) error {
	integration, err := uc.repo.FindByID(ctx, integrationID)
	if err != nil {
		return err
	}
	if integration == nil || integration.UserID != userID {
		return ErrEmailIntegrationNotFound
	}

	lastSync := time.Now()
	if sinceDate != nil {
		lastSync = *sinceDate
	}
	_, err = uc.repo.Update(ctx, integrationID, map[string]interface{}{
		"last_sync_at": lastSync,
	})
	return err
}

// --- helpers ---

func (uc *emailIntegrationUseCase) gmailOAuthConfig() *oauth2.Config {
	return &oauth2.Config{
		ClientID:     uc.googleClientID,
		ClientSecret: uc.googleSecret,
		RedirectURL:  uc.callbackURL,
		Scopes: []string{
			"https://www.googleapis.com/auth/gmail.readonly",
			"https://www.googleapis.com/auth/userinfo.email",
		},
		Endpoint: google.Endpoint,
	}
}

func testIMAPConnection(host string, port int) error {
	addr := fmt.Sprintf("%s:%d", host, port)
	var conn net.Conn
	var err error

	if port == 993 {
		conn, err = tls.DialWithDialer(
			&net.Dialer{Timeout: 10 * time.Second},
			"tcp", addr,
			&tls.Config{ServerName: host},
		)
	} else {
		conn, err = net.DialTimeout("tcp", addr, 10*time.Second)
	}

	if err != nil {
		return err
	}
	conn.Close()
	return nil
}
