// Package usecase — EmailImportService converts a parsed bank email into a Transaction.
// It handles account matching, duplicate prevention (idempotency key), and audit trail.
package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/fintrackr/api/internal/infrastructure/emailparser"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// EmailImportService orchestrates: parse result → Transaction creation.
type EmailImportService struct {
	msgRepo      domainrepo.EmailMessageRepository
	txRepo       domainrepo.TransactionRepository
	accountRepo  domainrepo.AccountRepository
	categoryRepo domainrepo.CategoryRepository
	ruleRepo     domainrepo.BankParserRuleRepository // may be nil (rules disabled)
}

// NewEmailImportService builds an EmailImportService with its dependencies.
// ruleRepo may be nil — when nil, only hardcoded parsers are used.
func NewEmailImportService(
	msgRepo domainrepo.EmailMessageRepository,
	txRepo domainrepo.TransactionRepository,
	accountRepo domainrepo.AccountRepository,
	categoryRepo domainrepo.CategoryRepository,
	ruleRepo domainrepo.BankParserRuleRepository,
) *EmailImportService {
	return &EmailImportService{
		msgRepo:      msgRepo,
		txRepo:       txRepo,
		accountRepo:  accountRepo,
		categoryRepo: categoryRepo,
		ruleRepo:     ruleRepo,
	}
}

// ProcessMessage parses the raw email content stored in msg and, if matched, creates
// a Transaction. It updates msg.ParseStatus in the database regardless of outcome.
func (s *EmailImportService) ProcessMessage(ctx context.Context, msg *entity.EmailMessage) error {
	bodyText := ""
	if msg.BodyText != nil {
		bodyText = *msg.BodyText
	}
	bodyHTML := ""
	if msg.BodyHTML != nil {
		bodyHTML = *msg.BodyHTML
	}

	// Load DB-managed parser rules (if repo is available).
	var dbRules []entity.BankParserRule
	if s.ruleRepo != nil {
		dbRules, _ = s.ruleRepo.FindAllActive(ctx)
	}

	result := emailparser.ParseWithRules(msg.From, msg.Subject, bodyText, bodyHTML, dbRules)

	if !result.Matched {
		reason := "no matching bank parser"
		return s.markSkipped(ctx, msg.ID, reason)
	}

	if result.Error != nil {
		errStr := result.Error.Error()
		return s.markFailed(ctx, msg.ID, errStr)
	}

	tx, err := s.buildTransaction(ctx, msg, result.Data)
	if err != nil {
		return s.markFailed(ctx, msg.ID, err.Error())
	}

	if err := s.txRepo.Create(ctx, tx); err != nil {
		// Idempotency-key conflict means we already imported this — skip gracefully.
		if strings.Contains(err.Error(), "idempotency_key") ||
			strings.Contains(err.Error(), "unique constraint") {
			reason := "already imported (idempotency key conflict)"
			return s.markSkipped(ctx, msg.ID, reason)
		}
		return s.markFailed(ctx, msg.ID, err.Error())
	}

	// Mark the email message as imported and link to the new transaction.
	now := time.Now()
	return s.msgRepo.UpdateStatus(ctx, msg.ID, map[string]interface{}{
		"parse_status":    "imported",
		"transaction_id":  tx.ID,
		"imported_at":     now,
		"parsed_bank":     result.Data.Bank,
		"parsed_type":     result.Data.Type,
		"parsed_amount":   result.Data.Amount,
		"parsed_merchant": nullableStr(result.Data.Merchant),
		"parsed_description": nullableStr(result.Data.Description),
		"parsed_account_number": nullableStr(result.Data.AccountNumber),
		"parsed_date":     result.Data.Date,
	})
}

// buildTransaction assembles an entity.Transaction from the ParsedTransaction result.
func (s *EmailImportService) buildTransaction(
	ctx context.Context,
	msg *entity.EmailMessage,
	parsed *emailparser.ParsedTransaction,
) (*entity.Transaction, error) {
	// Determine the transaction date — prefer what the parser extracted, fallback to email received time.
	txDate := msg.ReceivedAt
	if parsed.Date != nil {
		txDate = *parsed.Date
	}

	// Try to match a user account by bank code or account number.
	accountID, err := s.matchAccount(ctx, msg.UserID, parsed)
	if err != nil {
		return nil, fmt.Errorf("account match: %w", err)
	}

	// Determine the best category for this transaction.
	categoryID, err := s.matchCategory(ctx, msg.UserID, parsed)
	if err != nil {
		// Non-fatal — category can be set manually later.
		categoryID = nil
	}

	// Build description — prefer parser output, fallback to email subject.
	description := parsed.Description
	if description == "" {
		description = parsed.Merchant
	}
	if description == "" {
		description = msg.Subject
	}

	// Build idempotency key: userID + messageID to prevent duplicate imports.
	idempKey := fmt.Sprintf("email:%s:%s", msg.UserID.String(), msg.MessageID)

	// Serialise raw fields for audit.
	var rawData datatypes.JSON
	if len(parsed.RawFields) > 0 {
		b, _ := json.Marshal(parsed.RawFields)
		rawData = datatypes.JSON(b)
	}

	externalID := msg.MessageID

	tx := &entity.Transaction{
		ID:             uuid.New(),
		UserID:         msg.UserID,
		AccountID:      accountID,
		CategoryID:     categoryID,
		Type:           parsed.Type,
		Amount:         parsed.Amount,
		Currency:       "IDR",
		Description:    strPtr(description),
		Merchant:       nullableStr(parsed.Merchant),
		Source:         "email",
		Status:         "confirmed",
		Date:           txDate,
		RawData:        rawData,
		ExternalID:     strPtr(externalID),
		IdempotencyKey: strPtr(idempKey),
	}

	return tx, nil
}

// matchAccount finds the best-matching account for the parsed bank notification.
// Priority: exact account number match > bank code match > first active account > nil.
func (s *EmailImportService) matchAccount(
	ctx context.Context,
	userID uuid.UUID,
	parsed *emailparser.ParsedTransaction,
) (*uuid.UUID, error) {
	accounts, err := s.accountRepo.FindAllByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(accounts) == 0 {
		return nil, nil
	}

	bankCodeNorm := strings.ToUpper(strings.TrimSpace(parsed.Bank))
	parsedAccNum := strings.TrimSpace(parsed.AccountNumber)

	// 1. Try exact account-number match (last 4 digits or full).
	if parsedAccNum != "" {
		for _, acc := range accounts {
			if acc.AccountNumber == nil {
				continue
			}
			accNum := strings.TrimSpace(*acc.AccountNumber)
			if strings.HasSuffix(accNum, parsedAccNum) || accNum == parsedAccNum {
				id := acc.ID
				return &id, nil
			}
		}
	}

	// 2. Try bank code match.
	if bankCodeNorm != "" {
		for _, acc := range accounts {
			if acc.BankCode == nil {
				continue
			}
			if strings.EqualFold(*acc.BankCode, bankCodeNorm) {
				id := acc.ID
				return &id, nil
			}
		}
	}

	// 3. Fall back to the default account (if one exists).
	for _, acc := range accounts {
		if acc.IsDefault {
			id := acc.ID
			return &id, nil
		}
	}

	return nil, nil
}

// matchCategory attempts to auto-categorise using the merchant / description.
// Returns nil if no suitable category is found (caller treats as uncategorised).
func (s *EmailImportService) matchCategory(
	ctx context.Context,
	userID uuid.UUID,
	parsed *emailparser.ParsedTransaction,
) (*uuid.UUID, error) {
	// Only attempt for expense transactions — income/transfer stay uncategorised.
	if parsed.Type != "expense" {
		return nil, nil
	}

	categories, err := s.categoryRepo.FindAllForUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	target := strings.ToLower(parsed.Merchant + " " + parsed.Description)

	// Simple keyword match against category name.
	for _, cat := range categories {
		if strings.Contains(target, strings.ToLower(cat.Name)) {
			id := cat.ID
			return &id, nil
		}
	}

	return nil, nil
}

// markSkipped updates the email message status to "skipped" with a reason.
func (s *EmailImportService) markSkipped(ctx context.Context, id uuid.UUID, reason string) error {
	return s.msgRepo.UpdateStatus(ctx, id, map[string]interface{}{
		"parse_status": "skipped",
		"skip_reason":  reason,
	})
}

// markFailed updates the email message status to "failed" with an error message.
func (s *EmailImportService) markFailed(ctx context.Context, id uuid.UUID, errMsg string) error {
	return s.msgRepo.UpdateStatus(ctx, id, map[string]interface{}{
		"parse_status": "failed",
		"parse_error":  truncate(errMsg, 500),
	})
}

// ── helpers ──────────────────────────────────────────────────────────────────

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func nullableStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}
