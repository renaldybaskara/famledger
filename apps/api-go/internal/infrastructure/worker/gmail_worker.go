// Package worker — Gmail polling worker.
// Polls Gmail for bank notification emails using stored OAuth2 tokens.
// Self-hosted deployments cannot receive push webhooks reliably, so we poll.
package worker

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/fintrackr/api/internal/infrastructure/logger"
	"github.com/fintrackr/api/internal/usecase"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const (
	gmailPollInterval    = 5 * time.Minute
	gmailPageSize        = 100 // max allowed by Gmail API per page
	gmailMaxMessages     = 1000 // cap per poll cycle
	gmailAPIBase         = "https://gmail.googleapis.com/gmail/v1/users/me"
)

// GmailWorker manages one polling goroutine per active Gmail integration.
type GmailWorker struct {
	integrationRepo domainrepo.EmailIntegrationRepository
	msgRepo         domainrepo.EmailMessageRepository
	importSvc       *usecase.EmailImportService
	subUC           domainuc.SubscriptionUseCase
	oauthCfg        *oauth2.Config
	mu              sync.Mutex
	cancels         map[uuid.UUID]context.CancelFunc
}

// NewGmailWorker creates a GmailWorker ready to be started.
func NewGmailWorker(
	integrationRepo domainrepo.EmailIntegrationRepository,
	msgRepo domainrepo.EmailMessageRepository,
	importSvc *usecase.EmailImportService,
	subUC domainuc.SubscriptionUseCase,
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
		subUC:           subUC,
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
		logger.Worker.Printf("[GmailWorker] failed to load integrations: %v", err)
		return
	}

	newCount := 0
	for _, integ := range integrations {
		if integ.Provider != "gmail" {
			continue
		}
		if !w.subUC.IsProActive(ctx, integ.UserID) {
			w.StopIntegration(integ.ID)
			logger.Worker.Printf("[GmailWorker] skipping integration %s (%s) — user no longer Pro", integ.ID, integ.Email)
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
		logger.Worker.Printf("[GmailWorker] started %d new Gmail integration(s) (total: %d)", newCount, len(w.cancels))
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
	logger.Worker.Printf("%s starting poll loop", label)

	ticker := time.NewTicker(gmailPollInterval)
	defer ticker.Stop()

	for {
		if err := w.poll(ctx, integ); err != nil {
			logger.Worker.Printf("%s poll error: %v", label, err)
			if isUnrecoverableTokenError(err) {
				logger.Worker.Printf("%s unrecoverable token error — soft-deleting integration", label)
				_ = w.integrationRepo.Delete(ctx, integ.ID)
				delete(w.cancels, integ.ID)
				return
			}
		}
		// Refresh integration (tokens may have rotated).
		updated, err := w.integrationRepo.FindByID(ctx, integ.ID)
		if err == nil && updated != nil {
			integ = *updated
		}

		select {
		case <-ctx.Done():
			logger.Worker.Printf("%s stopped", label)
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
	// Set Expiry to past so oauth2 library always uses refresh_token to get a fresh access_token.
	tok := &oauth2.Token{
		AccessToken:  *integ.AccessToken,
		TokenType:    "Bearer",
		Expiry:       time.Now().Add(-time.Minute), // force refresh
	}
	if integ.RefreshToken != nil {
		tok.RefreshToken = *integ.RefreshToken
	}
	if tok.RefreshToken == "" {
		return fmt.Errorf("no refresh token — user must reconnect Gmail")
	}

	// savingTokenSource wraps the standard oauth2 token source and persists
	// refreshed tokens back to the database so the next poll uses the new token.
	base := w.oauthCfg.TokenSource(ctx, tok)
	saving := &savingTokenSource{
		base:    base,
		repo:    w.integrationRepo,
		integID: integ.ID,
		ctx:     ctx,
	}
	httpClient := oauth2.NewClient(ctx, saving)

	// Always reload integration from DB before determining since date.
	// This ensures manual resets of last_sync_at (e.g. for reprocessing) are respected
	// even while the poll loop is running, because the in-memory integ may be stale.
	if fresh, err := w.integrationRepo.FindByID(ctx, integ.ID); err == nil && fresh != nil {
		integ = *fresh
	}

	// Determine since date.
	// If last_sync_at is nil, the user has not yet set a start date via the date picker.
	// Skip this poll cycle and wait — do not use a default lookback.
	// This prevents the worker from fetching a large batch before the user
	// has had a chance to choose how far back to import.
	if integ.LastSyncAt == nil {
		logger.Worker.Printf("[GmailWorker %s] last_sync_at not set yet — waiting for user to pick a start date", integ.Email)
		return nil
	}
	since := *integ.LastSyncAt
	// Query all emails after `since` — deduplication via message_id in DB prevents re-import.
	// Do NOT filter by is:unread — bank emails may already be read by the user.
	sinceEpoch := since.Unix()
	// Filter by known bank/financial email domains so the 1000-message cap
	// is not exhausted by newsletters, social media etc.
	bankFilter := "from:(bri.co.id OR bankmandiri.co.id OR klikbca.com OR bni.co.id OR bankbsi.co.id OR cimbniaga.co.id OR permatabank.com OR danamon.co.id OR btn.co.id)"
	query := fmt.Sprintf("after:%d %s", sinceEpoch, bankFilter)

	// 1. List all message IDs matching the query — paginate until exhausted or cap hit.
	baseListURL := fmt.Sprintf("%s/messages?q=%s&maxResults=%d",
		gmailAPIBase,
		encodeQuery(query),
		gmailPageSize,
	)

	logger.Worker.Printf("[GmailWorker] polling since %s (epoch %d), query: %s", since.Format("2006-01-02 15:04"), sinceEpoch, query)
	msgIDs, capHit, err := w.listAllMessageIDs(ctx, httpClient, baseListURL)
	if err != nil {
		return fmt.Errorf("list messages: %w", err)
	}
	if capHit {
		logger.Worker.Printf("[GmailWorker] ⚠️  cap hit (%d) for %s — more messages exist, will continue next cycle",
			gmailMaxMessages, integ.Email)
	}
	logger.Worker.Printf("[GmailWorker] found %d message(s) for %s", len(msgIDs), integ.Email)
	if len(msgIDs) == 0 {
		_ = w.updateLastSyncTo(ctx, integ.ID, time.Now())
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
			logger.Worker.Printf("[GmailWorker] fetch %s: %v", gmailID, err)
			continue
		}

		em := buildEmailMessage(integ, gmailID, gMsg)
		newMsgs = append(newMsgs, em)
	}

	if len(newMsgs) == 0 {
		_ = w.updateLastSyncTo(ctx, integ.ID, time.Now())
		return nil
	}

	if err := w.msgRepo.CreateBatch(ctx, newMsgs); err != nil {
		return fmt.Errorf("batch insert: %w", err)
	}

	for i := range newMsgs {
		if err := w.importSvc.ProcessMessage(ctx, &newMsgs[i]); err != nil {
			logger.Worker.Printf("[GmailWorker] import error for %s: %v", newMsgs[i].MessageID, err)
		}
	}

	// Advance the bookmark:
	// - Cap NOT hit → all available messages processed → advance to now (normal).
	// - Cap WAS hit → more messages still exist beyond the cap → advance only to
	//   the oldest receivedAt in this batch so the next cycle picks up from there,
	//   not from now (which would skip the remaining messages permanently).
	if capHit {
		oldest := oldestReceivedAt(newMsgs)
		logger.Worker.Printf("[GmailWorker %s] cap hit — advancing last_sync_at to oldest processed (%s), next cycle will continue from there",
			integ.Email, oldest.Format("2006-01-02 15:04"))
		_ = w.updateLastSyncTo(ctx, integ.ID, oldest)
	} else {
		_ = w.updateLastSyncTo(ctx, integ.ID, time.Now())
	}
	logger.Worker.Printf("[GmailWorker %s] processed %d message(s)", integ.Email, len(newMsgs))
	return nil
}

// ── Gmail API helpers ─────────────────────────────────────────────────────────

type gmailListResponse struct {
	Messages []struct {
		ID string `json:"id"`
	} `json:"messages"`
	NextPageToken string `json:"nextPageToken"`
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

// listAllMessageIDs fetches all message IDs matching the query by following nextPageToken pagination.
// Stops early if gmailMaxMessages is reached to avoid flooding on initial sync.
// Returns the list of IDs and capHit=true when the cap was reached (meaning more messages exist
// beyond the cap that were not fetched — the caller should NOT advance last_sync_at to now).
func (w *GmailWorker) listAllMessageIDs(ctx context.Context, c *http.Client, baseURL string) (ids []string, capHit bool, err error) {
	var allIDs []string
	pageURL := baseURL
	for {
		result, err := w.listOnePage(ctx, c, pageURL)
		if err != nil {
			return nil, false, err
		}
		for _, m := range result.Messages {
			allIDs = append(allIDs, m.ID)
		}
		if len(allIDs) >= gmailMaxMessages {
			// Cap reached — there may be more messages beyond this point.
			return allIDs, true, nil
		}
		if result.NextPageToken == "" {
			break
		}
		pageURL = baseURL + "&pageToken=" + result.NextPageToken
	}
	return allIDs, false, nil
}

func (w *GmailWorker) listOnePage(ctx context.Context, c *http.Client, url string) (*gmailListResponse, error) {
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
	return &result, nil
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

// updateLastSyncTo sets last_sync_at to an explicit time.
// Use time.Now() for normal cycles, or the oldest processed message date when the cap was hit.
func (w *GmailWorker) updateLastSyncTo(ctx context.Context, id uuid.UUID, t time.Time) error {
	_, err := w.integrationRepo.Update(ctx, id, map[string]interface{}{
		"last_sync_at": t,
	})
	return err
}

// oldestReceivedAt returns the earliest ReceivedAt timestamp across a batch of messages.
// Used to set the bookmark when the message cap is hit, so the next cycle continues
// from where this one left off rather than jumping to now.
func oldestReceivedAt(msgs []entity.EmailMessage) time.Time {
	oldest := msgs[0].ReceivedAt
	for _, m := range msgs[1:] {
		if m.ReceivedAt.Before(oldest) {
			oldest = m.ReceivedAt
		}
	}
	return oldest
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

// savingTokenSource wraps an oauth2.TokenSource and persists refreshed tokens to DB.
type savingTokenSource struct {
	base    oauth2.TokenSource
	repo    domainrepo.EmailIntegrationRepository
	integID uuid.UUID
	ctx     context.Context
	last    string // last known access token to detect rotation
}

func (s *savingTokenSource) Token() (*oauth2.Token, error) {
	tok, err := s.base.Token()
	if err != nil {
		return nil, err
	}
// Persist only when access token rotated (avoids unnecessary DB writes).
	if tok.AccessToken != s.last {
		s.last = tok.AccessToken
		updates := map[string]interface{}{
			"access_token": tok.AccessToken,
		}
		if tok.RefreshToken != "" {
			updates["refresh_token"] = tok.RefreshToken
		}
		if !tok.Expiry.IsZero() {
			updates["watch_expiration"] = tok.Expiry
		}
		if _, dbErr := s.repo.Update(s.ctx, s.integID, updates); dbErr != nil {
			logger.Worker.Printf("[savingTokenSource] failed to persist rotated token: %v", dbErr)
		} else {
			logger.Worker.Printf("[savingTokenSource] persisted rotated access token for integration %s", s.integID)
		}
	}
	return tok, nil
}

// isUnrecoverableTokenError returns true for errors that cannot be fixed by retrying —
// the user must reconnect Gmail to issue a new refresh token.
func isUnrecoverableTokenError(err error) bool {
	if strings.Contains(err.Error(), "no refresh token") {
		return true
	}
	var rErr *oauth2.RetrieveError
	return errors.As(err, &rErr) && rErr.ErrorCode == "invalid_grant"
}
