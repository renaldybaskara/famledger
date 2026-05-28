// Package worker contains background goroutines for email polling.
package worker

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/emersion/go-imap"
	"github.com/emersion/go-imap/client"
	"github.com/emersion/go-message/mail"
	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/fintrackr/api/internal/usecase"
	"github.com/google/uuid"
)

const (
	imapPollInterval = 5 * time.Minute // how often to poll each inbox
	imapFetchLimit   = 50              // max unseen messages per cycle
	imapLookback     = 30 * 24 * time.Hour // how far back to look on first sync
)

// IMAPWorker manages one polling goroutine per active IMAP integration.
// Bank parser rules are loaded inside EmailImportService — not needed here.
type IMAPWorker struct {
	integrationRepo domainrepo.EmailIntegrationRepository
	msgRepo         domainrepo.EmailMessageRepository
	importSvc       *usecase.EmailImportService
	mu              sync.Mutex
	cancels         map[uuid.UUID]context.CancelFunc
}

// NewIMAPWorker creates an IMAPWorker ready to be started.
func NewIMAPWorker(
	integrationRepo domainrepo.EmailIntegrationRepository,
	msgRepo domainrepo.EmailMessageRepository,
	importSvc *usecase.EmailImportService,
) *IMAPWorker {
	return &IMAPWorker{
		integrationRepo: integrationRepo,
		msgRepo:         msgRepo,
		importSvc:       importSvc,
		cancels:         make(map[uuid.UUID]context.CancelFunc),
	}
}

// Start launches polling goroutines and keeps checking for new integrations every minute.
func (w *IMAPWorker) Start(ctx context.Context) {
	w.syncIntegrations(ctx)

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

// syncIntegrations loads active IMAP integrations and starts workers for new ones.
func (w *IMAPWorker) syncIntegrations(ctx context.Context) {
	integrations, err := w.integrationRepo.FindAllActive(ctx)
	if err != nil {
		log.Printf("[IMAPWorker] failed to load integrations: %v", err)
		return
	}
	newCount := 0
	for _, integ := range integrations {
		if integ.Provider != "imap" {
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
		log.Printf("[IMAPWorker] started %d new IMAP integration(s) (total: %d)", newCount, len(w.cancels))
	}
}

// StartIntegration launches a dedicated poller for one integration.
// Safe to call multiple times — stops any existing goroutine for that ID first.
func (w *IMAPWorker) StartIntegration(ctx context.Context, integ entity.EmailIntegration) {
	w.StopIntegration(integ.ID)

	child, cancel := context.WithCancel(ctx)
	w.mu.Lock()
	w.cancels[integ.ID] = cancel
	w.mu.Unlock()

	go w.pollLoop(child, integ)
}

// StopIntegration cancels the polling goroutine for one integration.
func (w *IMAPWorker) StopIntegration(id uuid.UUID) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if cancel, ok := w.cancels[id]; ok {
		cancel()
		delete(w.cancels, id)
	}
}

// pollLoop runs in its own goroutine, polling the IMAP inbox every imapPollInterval.
func (w *IMAPWorker) pollLoop(ctx context.Context, integ entity.EmailIntegration) {
	label := fmt.Sprintf("[IMAPWorker %s <%s>]", integ.ID, integ.Email)
	log.Printf("%s starting poll loop", label)

	// Run immediately on first tick, then every interval.
	ticker := time.NewTicker(imapPollInterval)
	defer ticker.Stop()

	for {
		if err := w.poll(ctx, integ); err != nil {
			log.Printf("%s poll error: %v", label, err)
		}
		// Refresh integration record in case credentials changed.
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

// poll dials the IMAP server, fetches unseen messages since last sync, stores and imports them.
func (w *IMAPWorker) poll(ctx context.Context, integ entity.EmailIntegration) error {
	if integ.ImapHost == nil || integ.ImapPort == nil ||
		integ.ImapUser == nil || integ.ImapPassword == nil {
		return fmt.Errorf("incomplete IMAP credentials")
	}

	host := *integ.ImapHost
	port := *integ.ImapPort
	user := *integ.ImapUser
	pass := *integ.ImapPassword
	addr := fmt.Sprintf("%s:%d", host, port)

	// Determine since date: last sync or 30 days ago.
	since := time.Now().Add(-imapLookback)
	if integ.LastSyncAt != nil {
		since = *integ.LastSyncAt
	}

	// Connect — use TLS for port 993, STARTTLS negotiation for 143.
	var c *client.Client
	var err error
	if port == 993 {
		tlsCfg := &tls.Config{ServerName: host}
		c, err = client.DialTLS(addr, tlsCfg)
	} else {
		c, err = client.Dial(addr)
	}
	if err != nil {
		return fmt.Errorf("dial %s: %w", addr, err)
	}
	defer c.Logout() //nolint:errcheck

	// STARTTLS upgrade for plain connections.
	if port != 993 {
		tlsCfg := &tls.Config{ServerName: host}
		if tlsErr := c.StartTLS(tlsCfg); tlsErr != nil {
			// Continue without TLS if server doesn't support it (dev setups).
			log.Printf("[IMAPWorker] STARTTLS failed for %s: %v — continuing plain", addr, tlsErr)
		}
	}

	if err = c.Login(user, pass); err != nil {
		return fmt.Errorf("login failed: %w", err)
	}

	// Select INBOX.
	if _, err = c.Select("INBOX", false); err != nil {
		return fmt.Errorf("select INBOX: %w", err)
	}

	// Search for unseen messages since `since`.
	criteria := imap.NewSearchCriteria()
	criteria.Since = since
	criteria.WithoutFlags = []string{imap.SeenFlag}

	uids, err := c.Search(criteria)
	if err != nil {
		return fmt.Errorf("search: %w", err)
	}
	if len(uids) == 0 {
		// Nothing new — update LastSyncAt and return.
		_ = w.updateLastSync(ctx, integ.ID)
		return nil
	}

	// Cap to avoid flooding.
	if len(uids) > imapFetchLimit {
		uids = uids[len(uids)-imapFetchLimit:]
	}

	seqSet := new(imap.SeqSet)
	seqSet.AddNum(uids...)

	// Fetch message envelope + body.
	messages := make(chan *imap.Message, 10)
	section := &imap.BodySectionName{}
	items := []imap.FetchItem{imap.FetchEnvelope, section.FetchItem()}

	fetchDone := make(chan error, 1)
	go func() {
		fetchDone <- c.Fetch(seqSet, items, messages)
	}()

	// Load existing message IDs to avoid re-inserting.
	knownIDs, err := w.msgRepo.FindMessageIDsSince(ctx, integ.ID, since)
	if err != nil {
		knownIDs = map[string]bool{}
	}

	var newMsgs []entity.EmailMessage

	for msg := range messages {
		if msg.Envelope == nil {
			continue
		}
		msgID := msg.Envelope.MessageId
		if msgID == "" {
			msgID = fmt.Sprintf("imap:%s:%d", integ.ID, msg.SeqNum)
		}
		if knownIDs[msgID] {
			continue // already in DB
		}

		from := ""
		if len(msg.Envelope.From) > 0 {
			from = msg.Envelope.From[0].Address()
		}

		bodyText, bodyHTML := extractBody(msg, section)
		subject := msg.Envelope.Subject

		em := entity.EmailMessage{
			ID:                 uuid.New(),
			EmailIntegrationID: integ.ID,
			UserID:             integ.UserID,
			MessageID:          msgID,
			Subject:            subject,
			From:               from,
			ReceivedAt:         msg.Envelope.Date,
			ParseStatus:        "pending",
		}
		if bodyText != "" {
			em.BodyText = &bodyText
		}
		if bodyHTML != "" {
			em.BodyHTML = &bodyHTML
		}
		newMsgs = append(newMsgs, em)
	}

	if err := <-fetchDone; err != nil {
		log.Printf("[IMAPWorker] fetch warning: %v", err)
	}

	if len(newMsgs) == 0 {
		_ = w.updateLastSync(ctx, integ.ID)
		return nil
	}

	// Batch-insert (ignores duplicates).
	if err := w.msgRepo.CreateBatch(ctx, newMsgs); err != nil {
		return fmt.Errorf("batch insert: %w", err)
	}

	// Process each new message.
	for i := range newMsgs {
		if err := w.importSvc.ProcessMessage(ctx, &newMsgs[i]); err != nil {
			log.Printf("[IMAPWorker] import error for msg %s: %v", newMsgs[i].MessageID, err)
		}
	}

	_ = w.updateLastSync(ctx, integ.ID)

	log.Printf("[IMAPWorker %s] processed %d new message(s)", integ.Email, len(newMsgs))
	return nil
}

// updateLastSync bumps the LastSyncAt timestamp on the integration record.
func (w *IMAPWorker) updateLastSync(ctx context.Context, id uuid.UUID) error {
	now := time.Now()
	_, err := w.integrationRepo.Update(ctx, id, map[string]interface{}{
		"last_sync_at": now,
	})
	return err
}

// extractBody reads text/plain and text/html parts from a go-imap message.
func extractBody(msg *imap.Message, section *imap.BodySectionName) (plain, html string) {
	r := msg.GetBody(section)
	if r == nil {
		return
	}
	mr, err := mail.CreateReader(r)
	if err != nil {
		// Not a MIME message — read raw body as plain text.
		b, _ := io.ReadAll(r)
		return strings.TrimSpace(string(b)), ""
	}
	for {
		part, err := mr.NextPart()
		if err != nil {
			break
		}
		ct := part.Header.Get("Content-Type")
		b, _ := io.ReadAll(part.Body)
		switch {
		case strings.HasPrefix(ct, "text/plain"):
			plain = strings.TrimSpace(string(b))
		case strings.HasPrefix(ct, "text/html"):
			html = strings.TrimSpace(string(b))
		}
	}
	return
}

// ── compile-time interface satisfaction check ────────────────────────────────

// dialTCP is a lightweight connectivity test used by the integration setup handler.
func DialTCPTest(host string, port int) error {
	addr := fmt.Sprintf("%s:%d", host, port)
	conn, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		return err
	}
	conn.Close()
	return nil
}
