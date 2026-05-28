// Package worker — Gmail polling worker.
// Polls Gmail for bank notification emails using stored OAuth2 tokens.
// Self-hosted deployments cannot receive push webhooks reliably, so we poll.
package worker

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/fintrackr/api/internal/usecase"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const (
	gmailPollInterval = 5 * time.Minute
	gmailFetchLimit   = 50
	gmailAPIBase      = "https://gmail.googleapis.com/gmail/v1/users/me"
)

// GmailWorker manages one polling goroutine per active Gmail integration.
type GmailWorker struct {
	integrationRepo domainrepo.EmailIntegrationRepository
	msgRepo         domainrepo.EmailMessageRepository
	importSvc       *usecase.EmailImportService
	oauthCfg        *oauth2.Config
	mu              sync.Mutex
	cancels         map[uuid.UUID]context.CancelFunc
}

// NewGmailWorker creates a GmailWorker ready to be started.
func NewGmailWorker(
	integrationRepo domainrepo.EmailIntegrationRepository,
	msgRepo domainrepo.EmailMessageRepository,
	importSvc *usecase.EmailImportService,
	googleClientID, googleSecret, callbackURL string,
) *GmailWorker {
	cfg := &oauth2.Config{
		ClientID:     googleClientID,
		ClientSecret: googleSecret,
		RedirectURL:  callbackURL,
		Scopes: []string{
			"https://www.googleapis.com/auth/gmail.readonly",
			"https://www.googleapis.com/auth/userinfo.email",
		},
		Endpoint: google.Endpoint,
	}
	return &GmailWorker{
		integrationRepo: integrationRepo,
		msgRepo:         msgRepo,
		importSvc:       importSvc,
		oauthCfg:        cfg,
		cancels:         make(map[uuid.UUID]context.CancelFunc),
	}
}

// Start launches polling goroutines and keeps checking for new integrations every minute.
func (w *GmailWorker) Start(ctx context.Context) {
	w.syncIntegrations(ctx)

	// Re-check DB every minute to pick up newly connected Gmail accounts
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.syncIntegrations(ctx)
		}
	}
}

// syncIntegrations loads all active Gmail integrations and starts workers for any new ones.
func (w *GmailWorker) syncIntegrations(ctx context.Context) {
	integrations, err := w.integrationRepo.FindAllActive(ctx)
	if err != nil {
		log.Printf("[GmailWorker] failed to load integrations: %v", err)
		return
	}

	newCount := 0
	for _, integ := range integrations {
		if integ.Provider != "gmail" {
			continue
		}
		w.mu.Lock()
		_, running := w.cancels[integ.ID]
		w.mu.Unlock()
		if !running {
			w.StartIntegration(ctx, integ)
			newCount++
		}
	}
	if newCount > 0 {
		log.Printf("[GmailWorker] started %d new Gmail integration(s) (total: %d)", newCount, len(w.cancels))
	}
}

// StartIntegration launches or restarts a polling goroutine for one integration.
func (w *GmailWorker) StartIntegration(ctx context.Context, integ entity.EmailIntegration) {
	w.StopIntegration(integ.ID)
	child, cancel := context.WithCancel(ctx)
	w.mu.Lock()
	w.cancels[integ.ID] = cancel
	w.mu.Unlock()
	go w.pollLoop(child, integ)
}

// StopIntegration cancels the polling goroutine for one integration.
func (w *GmailWorker) StopIntegration(id uuid.UUID) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if cancel, ok := w.cancels[id]; ok {
		cancel()
		delete(w.cancels, id)
	}
}

func (w *GmailWorker) pollLoop(ctx context.Context, integ entity.EmailIntegration) {
	label := fmt.Sprintf("[GmailWorker %s <%s>]", integ.ID, integ.Email)
	log.Printf("%s starting poll loop", label)

	ticker := time.NewTicker(gmailPollInterval)
	defer ticker.Stop()

	for {
		if err := w.poll(ctx, integ); err != nil {
			log.Printf("%s poll error: %v", label, err)
		}
		// Refresh integration (tokens may have rotated).
		updated, err := w.integrationRepo.FindByID(ctx, integ.ID)
		if err == nil && updated != nil {
			integ = *updated
		}

		select {
		case <-ctx.Done():
			log.Printf("%s stopped", label)
			return
		case <-ticker.C:
		}
	}
}

func (w *GmailWorker) poll(ctx context.Context, integ entity.EmailIntegration) error {
	if integ.AccessToken == nil {
		return fmt.Errorf("no access token stored")
	}

	// Build token from stored values.
	tok := &oauth2.Token{
		AccessToken:  *integ.AccessToken,
		TokenType:    "Bearer",
	}
	if integ.RefreshToken != nil {
		tok.RefreshToken = *integ.RefreshToken
	}

	// Create an auto-refreshing HTTP client.
	httpClient := w.oauthCfg.Client(ctx, tok)

	// Determine since date.
	since := time.Now().Add(-imapLookback)
	if integ.LastSyncAt != nil {
		since = *integ.LastSyncAt
	}
	// Gmail query: newer_than in days, plus only unread mails we haven't seen.
	sinceEpoch := since.Unix()
	query := fmt.Sprintf("after:%d is:unread", sinceEpoch)

	// 1. List message IDs matching the query.
	listURL := fmt.Sprintf("%s/messages?q=%s&maxResults=%d",
		gmailAPIBase,
		encodeQuery(query),
		gmailFetchLimit,
	)

	msgIDs, err := w.listMessageIDs(ctx, httpClient, listURL)
	if err != nil {
		return fmt.Errorf("list messages: %w", err)
	}
	if len(msgIDs) == 0 {
		_ = w.updateLastSync(ctx, integ.ID, tok)
		return nil
	}

	// Load known IDs to avoid duplicates.
	knownIDs, _ := w.msgRepo.FindMessageIDsSince(ctx, integ.ID, since)

	var newMsgs []entity.EmailMessage

	for _, gmailID := range msgIDs {
		if knownIDs[gmailID] {
			continue
		}
		gMsg, err := w.fetchMessage(ctx, httpClient, gmailID)
		if err != nil {
			log.Printf("[GmailWorker] fetch %s: %v", gmailID, err)
			continue
		}

		em := buildEmailMessage(integ, gmailID, gMsg)
		newMsgs = append(newMsgs, em)
	}

	if len(newMsgs) == 0 {
		_ = w.updateLastSync(ctx, integ.ID, tok)
		return nil
	}

	if err := w.msgRepo.CreateBatch(ctx, newMsgs); err != nil {
		return fmt.Errorf("batch insert: %w", err)
	}

	for i := range newMsgs {
		if err := w.importSvc.ProcessMessage(ctx, &newMsgs[i]); err != nil {
			log.Printf("[GmailWorker] import error for %s: %v", newMsgs[i].MessageID, err)
		}
	}

	_ = w.updateLastSync(ctx, integ.ID, tok)
	log.Printf("[GmailWorker %s] processed %d message(s)", integ.Email, len(newMsgs))
	return nil
}

// ── Gmail API helpers ─────────────────────────────────────────────────────────

type gmailListResponse struct {
	Messages []struct {
		ID string `json:"id"`
	} `json:"messages"`
}

type gmailMessage struct {
	ID      string `json:"id"`
	Payload struct {
		Headers []struct {
			Name  string `json:"name"`
			Value string `json:"value"`
		} `json:"headers"`
		Parts []struct {
			MimeType string `json:"mimeType"`
			Body     struct {
				Data string `json:"data"`
				Size int    `json:"size"`
			} `json:"body"`
			Parts []struct {
				MimeType string `json:"mimeType"`
				Body     struct {
					Data string `json:"data"`
				} `json:"body"`
			} `json:"parts"`
		} `json:"parts"`
		Body struct {
			Data string `json:"data"`
		} `json:"body"`
		MimeType string `json:"mimeType"`
	} `json:"payload"`
}

func (w *GmailWorker) listMessageIDs(ctx context.Context, c *http.Client, url string) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("list API returned %d: %s", resp.StatusCode, string(b))
	}

	var result gmailListResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	ids := make([]string, 0, len(result.Messages))
	for _, m := range result.Messages {
		ids = append(ids, m.ID)
	}
	return ids, nil
}

func (w *GmailWorker) fetchMessage(ctx context.Context, c *http.Client, gmailID string) (*gmailMessage, error) {
	url := fmt.Sprintf("%s/messages/%s?format=full", gmailAPIBase, gmailID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("message API returned %d: %s", resp.StatusCode, string(b))
	}

	var msg gmailMessage
	if err := json.NewDecoder(resp.Body).Decode(&msg); err != nil {
		return nil, err
	}
	return &msg, nil
}

// buildEmailMessage converts a Gmail API message into our entity.
func buildEmailMessage(integ entity.EmailIntegration, gmailID string, gMsg *gmailMessage) entity.EmailMessage {
	var from, subject string
	var receivedAt time.Time

	for _, h := range gMsg.Payload.Headers {
		switch strings.ToLower(h.Name) {
		case "from":
			from = h.Value
		case "subject":
			subject = h.Value
		case "date":
			if t, err := parseEmailDate(h.Value); err == nil {
				receivedAt = t
			}
		}
	}
	if receivedAt.IsZero() {
		receivedAt = time.Now()
	}

	plain, html := extractGmailBody(gMsg)

	em := entity.EmailMessage{
		ID:                 uuid.New(),
		EmailIntegrationID: integ.ID,
		UserID:             integ.UserID,
		MessageID:          gmailID,
		Subject:            subject,
		From:               from,
		ReceivedAt:         receivedAt,
		ParseStatus:        "pending",
	}
	if plain != "" {
		em.BodyText = &plain
	}
	if html != "" {
		em.BodyHTML = &html
	}
	return em
}

// extractGmailBody walks the Gmail message payload to find text/plain and text/html parts.
func extractGmailBody(msg *gmailMessage) (plain, html string) {
	// Single-part message.
	if msg.Payload.Body.Data != "" {
		decoded, err := base64.URLEncoding.DecodeString(msg.Payload.Body.Data)
		if err == nil {
			switch msg.Payload.MimeType {
			case "text/plain":
				plain = string(decoded)
			case "text/html":
				html = string(decoded)
			}
		}
	}

	// Walk parts.
	for _, part := range msg.Payload.Parts {
		data := part.Body.Data
		if data == "" {
			// Check nested parts (multipart/alternative inside multipart/mixed).
			for _, nested := range part.Parts {
				if nested.Body.Data == "" {
					continue
				}
				decoded, err := base64.URLEncoding.DecodeString(nested.Body.Data)
				if err != nil {
					continue
				}
				switch nested.MimeType {
				case "text/plain":
					if plain == "" {
						plain = string(decoded)
					}
				case "text/html":
					if html == "" {
						html = string(decoded)
					}
				}
			}
			continue
		}
		decoded, err := base64.URLEncoding.DecodeString(data)
		if err != nil {
			continue
		}
		switch part.MimeType {
		case "text/plain":
			if plain == "" {
				plain = string(decoded)
			}
		case "text/html":
			if html == "" {
				html = string(decoded)
			}
		}
	}
	return strings.TrimSpace(plain), strings.TrimSpace(html)
}

func (w *GmailWorker) updateLastSync(ctx context.Context, id uuid.UUID, tok *oauth2.Token) error {
	now := time.Now()
	updates := map[string]interface{}{
		"last_sync_at": now,
	}
	// Persist rotated access token if it changed.
	if tok != nil && tok.AccessToken != "" {
		updates["access_token"] = tok.AccessToken
		if tok.RefreshToken != "" {
			updates["refresh_token"] = tok.RefreshToken
		}
	}
	_, err := w.integrationRepo.Update(ctx, id, updates)
	return err
}

func encodeQuery(q string) string {
	// Simple URL encoding of the Gmail query string.
	q = strings.ReplaceAll(q, " ", "+")
	return q
}

// parseEmailDate tries common RFC 2822 date formats used in email headers.
func parseEmailDate(s string) (time.Time, error) {
	formats := []string{
		"Mon, 2 Jan 2006 15:04:05 -0700",
		"Mon, 2 Jan 2006 15:04:05 +0000 (UTC)",
		"2 Jan 2006 15:04:05 -0700",
		"Mon, 2 Jan 2006 15:04:05 MST",
		time.RFC1123Z,
		time.RFC1123,
	}
	s = strings.TrimSpace(s)
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognised date format: %s", s)
}
