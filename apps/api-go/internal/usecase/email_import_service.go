// Package usecase — EmailImportService converts a parsed bank email into a Transaction.
// It handles account matching, duplicate prevention (idempotency key), and audit trail.
package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	aisvc "github.com/fintrackr/api/internal/infrastructure/ai"
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
	aiSvc        *aisvc.OpenRouterService             // may be nil (AI disabled)
}

// NewEmailImportService builds an EmailImportService with its dependencies.
// ruleRepo may be nil — when nil, only hardcoded parsers are used.
// aiSvc may be nil — when nil, AI fallback is disabled.
func NewEmailImportService(
	msgRepo domainrepo.EmailMessageRepository,
	txRepo domainrepo.TransactionRepository,
	accountRepo domainrepo.AccountRepository,
	categoryRepo domainrepo.CategoryRepository,
	ruleRepo domainrepo.BankParserRuleRepository,
	aiSvc *aisvc.OpenRouterService,
) *EmailImportService {
	return &EmailImportService{
		msgRepo:      msgRepo,
		txRepo:       txRepo,
		accountRepo:  accountRepo,
		categoryRepo: categoryRepo,
		ruleRepo:     ruleRepo,
		aiSvc:        aiSvc,
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
		// No parser recognised this email. Try AI full-extraction when financial signals
		// are present and the email is not clearly non-financial (promo, reply, etc.).
		if s.aiSvc != nil && s.aiSvc.Enabled() {
			body := bodyText
			if body == "" {
				body = bodyHTML
			}
			cls := classifyEmail(msg.Subject, body)
			if cls.IsFinancial && !cls.SkipAI {
				return s.tryAIFull(ctx, msg, body, 0)
			}
		}
		return s.markSkipped(ctx, msg.ID, "no matching bank parser")
	}

	// DB rule matched the sender but has no extraction config → route to AI, then
	// graduate the rule so future emails use it directly without AI.
	if result.IsAIOnly {
		if s.aiSvc == nil || !s.aiSvc.Enabled() {
			return s.markSkipped(ctx, msg.ID, "bank terdaftar tapi AI tidak aktif (konfigurasi OPENROUTER_API_KEY)")
		}
		body := bodyText
		if body == "" {
			body = bodyHTML
		}
		return s.tryAIFull(ctx, msg, body, result.MatchedRuleID)
	}

	if result.Error != nil {
		errStr := result.Error.Error()
		return s.markFailed(ctx, msg.ID, errStr)
	}

	// AI enrichment for matched emails: called only when merchant is unclear.
	// For matched emails (parser already confirmed bank origin) we only check skip
	// signals — no need to re-verify financial content.
	if s.aiSvc != nil && s.aiSvc.Enabled() && result.Data != nil {
		body := bodyText
		if body == "" {
			body = bodyHTML
		}
		cls := classifyEmail(msg.Subject, body)

		merchantUnclear := result.Data.Merchant == "" ||
			strings.HasPrefix(strings.ToUpper(result.Data.Merchant), "NBMB") ||
			result.Data.Merchant == result.Data.Description

		if merchantUnclear && !cls.SkipAI {
			aiResult, err := s.aiSvc.ParseEmailContent(ctx, msg.Subject, body)
			if err != nil {
				log.Printf("[AI] parse error for msg %s: %v", msg.MessageID, err)
			} else {
				log.Printf("[AI] msg %s → merchant=%q type=%q category=%q",
					msg.MessageID, aiResult.Merchant, aiResult.Type, aiResult.Category)

				if aiResult.Merchant != "" {
					result.Data.Merchant = aiResult.Merchant
				}
				if aiResult.Type != "" && result.Data.Type == "" {
					result.Data.Type = aiResult.Type
				}
				if aiResult.Category != "" {
					result.Data.RawFields["ai_category"] = aiResult.Category
				}

				msg.AIUsed = true
				if b, _ := json.Marshal(aiResult); b != nil {
					msg.AIRawResult = datatypes.JSON(b)
				}
			}
		}
	}

	// Fuzzy-dedup: some banks (e.g. BRI) send the same notification twice with slightly
	// different dates (one correct, one set to the re-delivery date). If a transaction with
	// the same bank/type/amount/merchant already exists within a 2-hour window, skip.
	// Keep the window short (2h) to avoid falsely skipping legitimate repeat purchases.
	if result.Data.Merchant != "" {
		after := msg.ReceivedAt.Add(-2 * time.Hour)
		dup, err := s.txRepo.ExistsByAmountMerchantWindow(
			ctx, msg.UserID,
			result.Data.Bank, result.Data.Type,
			int64(result.Data.Amount*100),
			strings.ToLower(strings.TrimSpace(result.Data.Merchant)),
			after,
		)
		if err != nil {
			log.Printf("[EmailImport] fuzzy-dedup check error for msg %s: %v", msg.MessageID, err)
		} else if dup {
			return s.markSkipped(ctx, msg.ID, "duplicate (fuzzy match: same bank/type/amount/merchant within 30d)")
		}
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
		"parse_status":          "imported",
		"transaction_id":        tx.ID,
		"imported_at":           now,
		"parsed_bank":           result.Data.Bank,
		"parsed_type":           result.Data.Type,
		"parsed_amount":         result.Data.Amount,
		"parsed_merchant":       nullableStr(result.Data.Merchant),
		"parsed_description":    nullableStr(result.Data.Description),
		"parsed_account_number": nullableStr(result.Data.AccountNumber),
		"parsed_date":           result.Data.Date,
		"ai_used":               msg.AIUsed,
		"ai_raw_result":         msg.AIRawResult,
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

	// Build idempotency key: userID + bank + type + amountCents + txDate + normalizedMerchant.
	// Merchant is included so that two different payees for the same amount on the same day
	// are kept as separate transactions. Whichever email arrives first wins; duplicates are
	// blocked by the unique constraint on idempotency_key.
	txDateDay := msg.ReceivedAt.Format("2006-01-02")
	if parsed.Date != nil {
		txDateDay = parsed.Date.Format("2006-01-02")
	}
	amountCents := int64(parsed.Amount * 100)
	merchantNorm := strings.ToLower(strings.TrimSpace(parsed.Merchant))
	idempKey := fmt.Sprintf("txn:%s:%s:%s:%d:%s:%s",
		msg.UserID.String(), parsed.Bank, parsed.Type, amountCents, txDateDay, merchantNorm)

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

// categoryKeywords maps keyword (lowercase) → canonical category name fragment.
// The fragment is matched case-insensitively against user's category names.
// Order matters — more specific keywords first.
var categoryKeywords = []struct {
	keyword  string
	category string
}{
	// ── Makanan & Minuman ────────────────────────────────────────────────────
	{"warung makan", "makanan"}, {"rumah makan", "makanan"},
	{"restoran", "makanan"}, {"restaurant", "makanan"},
	{"mie ayam", "makanan"}, {"mie goreng", "makanan"},
	{"nasi goreng", "makanan"}, {"nasi padang", "makanan"},
	{"nasi uduk", "makanan"}, {"nasi kuning", "makanan"},
	{"bakso", "makanan"}, {"soto", "makanan"}, {"rawon", "makanan"},
	{"ayam goreng", "makanan"}, {"ayam bakar", "makanan"},
	{"sate ayam", "makanan"}, {"sate kambing", "makanan"},
	{"sate", "makanan"}, {"sei sapi", "makanan"}, {"sapi", "makanan"},
	{"ikan bakar", "makanan"}, {"ikan goreng", "makanan"}, {"ikan", "makanan"},
	{"seafood", "makanan"}, {"cumi", "makanan"}, {"udang", "makanan"},
	{"pecel", "makanan"}, {"gado gado", "makanan"}, {"ketoprak", "makanan"},
	{"lontong", "makanan"}, {"kupat", "makanan"}, {"ketupat", "makanan"},
	{"martabak", "makanan"}, {"siomay", "makanan"}, {"batagor", "makanan"},
	{"burger", "makanan"}, {"pizza", "makanan"}, {"kebab", "makanan"},
	{"sandwich", "makanan"}, {"hotdog", "makanan"}, {"steak", "makanan"},
	{"pasta", "makanan"}, {"spaghetti", "makanan"},
	{"roti", "makanan"}, {"donat", "makanan"}, {"cake", "makanan"},
	{"bakery", "makanan"}, {"bread", "makanan"}, {"kue", "makanan"},
	{"jajan", "makanan"}, {"snack", "makanan"}, {"cemilan", "makanan"},
	{"es krim", "makanan"}, {"ice cream", "makanan"}, {"boba", "makanan"},
	{"bubble tea", "makanan"}, {"milkshake", "makanan"},
	{"makan", "makanan"}, {"food", "makanan"}, {"kuliner", "makanan"},
	// ── Kopi & Minuman ──────────────────────────────────────────────────────
	{"kopi", "kopi"}, {"coffee", "kopi"}, {"cafe", "kopi"},
	{"starbucks", "kopi"}, {"kopi kenangan", "kopi"}, {"janji jiwa", "kopi"},
	{"fore", "kopi"}, {"excelso", "kopi"}, {"bengawan solo", "kopi"},
	{"teh", "kopi"}, {"minuman", "kopi"},
	// ── Transport ───────────────────────────────────────────────────────────
	{"grab", "transport"}, {"gojek", "transport"}, {"gocar", "transport"},
	{"grabcar", "transport"}, {"grabike", "transport"}, {"goride", "transport"},
	{"maxim", "transport"}, {"indriver", "transport"}, {"bluebird", "transport"},
	{"express taxi", "transport"}, {"taxi", "transport"}, {"taksi", "transport"},
	{"ojek", "transport"}, {"angkot", "transport"}, {"angkutan", "transport"},
	{"busway", "transport"}, {"transjakarta", "transport"}, {"commuter", "transport"},
	{"kereta", "transport"}, {"krl", "transport"}, {"lrt", "transport"},
	{"mrt", "transport"}, {"tol", "transport"}, {"parkir", "transport"},
	{"parking", "transport"}, {"pertamina", "transport"}, {"shell", "transport"},
	{"vivo", "transport"}, {"bbm", "transport"}, {"bensin", "transport"},
	{"solar", "transport"}, {"spbu", "transport"}, {"tiket", "transport"},
	// ── Belanja ─────────────────────────────────────────────────────────────
	{"alfamart", "belanja"}, {"indomaret", "belanja"}, {"alfamidi", "belanja"},
	{"circle k", "belanja"}, {"lawson", "belanja"}, {"family mart", "belanja"},
	{"superindo", "belanja"}, {"hero", "belanja"}, {"giant", "belanja"},
	{"hypermart", "belanja"}, {"carrefour", "belanja"}, {"lotte mart", "belanja"},
	{"transmart", "belanja"}, {"robinson", "belanja"},
	{"shopee", "belanja"}, {"tokopedia", "belanja"}, {"lazada", "belanja"},
	{"bukalapak", "belanja"}, {"blibli", "belanja"}, {"zalora", "belanja"},
	{"jd.id", "belanja"}, {"tiktok shop", "belanja"}, {"tiktokshop", "belanja"},
	{"midtrans", "belanja"}, {"doku", "belanja"}, {"xendit", "belanja"},
	{"belanja", "belanja"}, {"shopping", "belanja"}, {"toko", "belanja"},
	// ── Tagihan ─────────────────────────────────────────────────────────────
	{"bpjs", "tagihan"}, {"pln", "tagihan"}, {"listrik", "tagihan"},
	{"pdam", "tagihan"}, {"air bersih", "tagihan"}, {"telkom", "tagihan"},
	{"indihome", "tagihan"}, {"myrepublic", "tagihan"}, {"firstmedia", "tagihan"},
	{"biznet", "tagihan"}, {"cbnintel", "tagihan"}, {"internet", "tagihan"},
	{"wifi", "tagihan"}, {"tagihan", "tagihan"}, {"bill", "tagihan"},
	{"iuran", "tagihan"}, {"cicilan", "tagihan"}, {"angsuran", "tagihan"},
	{"kredit", "tagihan"}, {"kartu kredit", "tagihan"}, {"leasing", "tagihan"},
	{"asuransi", "tagihan"}, {"premi", "tagihan"},
	// ── Kesehatan ───────────────────────────────────────────────────────────
	{"apotek", "kesehatan"}, {"apotik", "kesehatan"}, {"pharmacy", "kesehatan"},
	{"kimia farma", "kesehatan"}, {"century", "kesehatan"}, {"guardian", "kesehatan"},
	{"k24", "kesehatan"}, {"viva", "kesehatan"}, {"generik", "kesehatan"},
	{"obat", "kesehatan"}, {"vitamin", "kesehatan"}, {"suplemen", "kesehatan"},
	{"rumah sakit", "kesehatan"}, {"rs ", "kesehatan"}, {"klinik", "kesehatan"},
	{"puskesmas", "kesehatan"}, {"dokter", "kesehatan"}, {"dr.", "kesehatan"},
	{"dental", "kesehatan"}, {"gigi", "kesehatan"}, {"optik", "kesehatan"},
	{"laboratorium", "kesehatan"}, {"lab ", "kesehatan"}, {"medis", "kesehatan"},
	// ── Pendidikan ──────────────────────────────────────────────────────────
	{"sekolah", "pendidikan"}, {"kampus", "pendidikan"}, {"universitas", "pendidikan"},
	{"spp", "pendidikan"}, {"ukt", "pendidikan"}, {"kursus", "pendidikan"},
	{"les ", "pendidikan"}, {"bimbel", "pendidikan"}, {"ruangguru", "pendidikan"},
	{"zenius", "pendidikan"}, {"duolingo", "pendidikan"}, {"coursera", "pendidikan"},
	{"udemy", "pendidikan"}, {"buku", "pendidikan"}, {"alat tulis", "pendidikan"},
	// ── Hiburan & Langganan ─────────────────────────────────────────────────
	{"netflix", "langganan"}, {"spotify", "langganan"}, {"youtube", "langganan"},
	{"disney", "langganan"}, {"vidio", "langganan"}, {"mola tv", "langganan"},
	{"viu", "langganan"}, {"iflix", "langganan"}, {"wetv", "langganan"},
	{"apple", "langganan"}, {"google play", "langganan"}, {"playstation", "langganan"},
	{"steam", "langganan"}, {"xbox", "langganan"}, {"game", "langganan"},
	{"bioskop", "hiburan"}, {"cinema", "hiburan"}, {"cgv", "hiburan"},
	{"cinepolis", "hiburan"}, {"xxi", "hiburan"}, {"21", "hiburan"},
	{"karaoke", "hiburan"}, {"bowling", "hiburan"}, {"gym", "hiburan"},
	{"fitness", "hiburan"}, {"olahraga", "hiburan"},
	// ── Rumah ───────────────────────────────────────────────────────────────
	{"ace hardware", "rumah"}, {"informa", "rumah"}, {"ikea", "rumah"},
	{"electronic city", "rumah"}, {"dekoruma", "rumah"},
	{"kontrakan", "rumah"}, {"kos ", "rumah"}, {"sewa", "rumah"},
	{"properti", "rumah"}, {"renovasi", "rumah"},
}

// aiCategoryAliases normalises the English/shorthand category words that OpenRouter
// may return into the Indonesian fragments used in matchCategory keyword lookup.
// Keys are lowercase; values are the same canonical fragments as categoryKeywords.
var aiCategoryAliases = map[string]string{
	"food":           "makanan",
	"food & drink":   "makanan",
	"makanan":        "makanan",
	"coffee":         "kopi",
	"kopi":           "kopi",
	"transport":      "transport",
	"transportation": "transport",
	"transportasi":   "transport",
	"shopping":       "belanja",
	"belanja":        "belanja",
	"bills":          "tagihan",
	"utilities":      "tagihan",
	"tagihan":        "tagihan",
	"health":         "kesehatan",
	"kesehatan":      "kesehatan",
	"education":      "pendidikan",
	"pendidikan":     "pendidikan",
	"entertainment":  "hiburan",
	"hiburan":        "hiburan",
	"subscription":   "langganan",
	"langganan":      "langganan",
	"housing":        "rumah",
	"rumah":          "rumah",
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

	// Step 1: AI category hint — normalise via alias table first so English words
	// returned by the AI ("food", "transport") map to Indonesian category names.
	if aiCategory, ok := parsed.RawFields["ai_category"]; ok && aiCategory != "" {
		fragment := strings.ToLower(strings.TrimSpace(aiCategory))
		if normalised, found := aiCategoryAliases[fragment]; found {
			fragment = normalised
		}
		for _, cat := range categories {
			if strings.Contains(strings.ToLower(cat.Name), fragment) {
				id := cat.ID
				return &id, nil
			}
		}
	}

	// Step 2: match against keyword map → get canonical category fragment
	matchedFragment := ""
	for _, kw := range categoryKeywords {
		if strings.Contains(target, kw.keyword) {
			matchedFragment = kw.category
			break
		}
	}

	// Step 3: find user's category whose name contains the matched fragment
	if matchedFragment != "" {
		for _, cat := range categories {
			if strings.Contains(strings.ToLower(cat.Name), matchedFragment) {
				id := cat.ID
				return &id, nil
			}
		}
	}

	// Step 4: fallback — match category name directly against merchant string
	for _, cat := range categories {
		if strings.Contains(target, strings.ToLower(cat.Name)) {
			id := cat.ID
			return &id, nil
		}
	}

	return nil, nil
}

// tryAIFull runs AI full-extraction for unrecognised financial emails.
// When ruleID > 0, the matching DB rule is graduated (amountRegex + defaultType set)
// after a successful AI parse so that subsequent emails skip AI entirely.
func (s *EmailImportService) tryAIFull(ctx context.Context, msg *entity.EmailMessage, body string, ruleID uint) error {
	aiResult, err := s.aiSvc.ParseEmailFull(ctx, msg.Subject, body)
	if err != nil {
		log.Printf("[AI-Full] error for msg %s: %v", msg.MessageID, err)
		return s.markSkipped(ctx, msg.ID, "no matching bank parser")
	}

	amount, ok := aisvc.ValidateFullParseResult(aiResult)
	if !ok {
		log.Printf("[AI-Full] low-confidence result for msg %s: type=%q amount=%q", msg.MessageID, aiResult.Type, aiResult.Amount)
		return s.markSkipped(ctx, msg.ID, "no matching bank parser (ai: low confidence)")
	}

	log.Printf("[AI-Full] msg %s → type=%q amount=%.2f merchant=%q category=%q",
		msg.MessageID, aiResult.Type, amount, aiResult.Merchant, aiResult.Category)

	// Graduate or auto-create a DB rule so future emails from this sender skip AI.
	if s.ruleRepo != nil {
		defaultType := strings.ToLower(strings.TrimSpace(aiResult.Type))
		if defaultType != "income" && defaultType != "transfer" {
			defaultType = "expense"
		}
		if ruleID > 0 {
			// User-added rule (IsAIOnly): fill amountRegex + defaultType.
			if _, updateErr := s.ruleRepo.Update(ctx, ruleID, map[string]interface{}{
				"amount_regex": `(?i)Rp\.?\s*(?P<amount>[\d.,]+)`,
				"default_type": defaultType,
			}); updateErr != nil {
				log.Printf("[ParserRule] failed to graduate rule %d: %v", ruleID, updateErr)
			} else {
				log.Printf("[ParserRule] graduated rule %d → defaultType=%s", ruleID, defaultType)
			}
		} else {
			// Unknown sender: auto-create a rule so next email from this domain skips AI.
			domain := extractEmailDomain(msg.From)
			if domain != "" {
				newRule := &entity.BankParserRule{
					Name:         "Auto: " + domain,
					FromPatterns: "@" + domain,
					AmountRegex:  `(?i)Rp\.?\s*(?P<amount>[\d.,]+)`,
					DefaultType:  defaultType,
					IsActive:     true,
					IsGlobal:     true,
					Note:         "Dibuat otomatis dari AI learning",
				}
				if createErr := s.ruleRepo.Create(ctx, newRule); createErr != nil {
					// Name conflict means rule already exists — not an error.
					log.Printf("[ParserRule] auto-create for %q skipped: %v", domain, createErr)
				} else {
					log.Printf("[ParserRule] auto-created rule %q → defaultType=%s", newRule.Name, defaultType)
				}
			}
		}
	}

	parsed := &emailparser.ParsedTransaction{
		Bank:      "ai",
		Type:      strings.ToLower(strings.TrimSpace(aiResult.Type)),
		Amount:    amount,
		Merchant:  aiResult.Merchant,
		RawFields: map[string]string{},
	}
	if aiResult.Category != "" {
		parsed.RawFields["ai_category"] = aiResult.Category
	}

	// Fuzzy dedup — same logic as the normal flow; dedup is not skipped for AI results.
	if parsed.Merchant != "" {
		after := msg.ReceivedAt.Add(-2 * time.Hour)
		dup, err := s.txRepo.ExistsByAmountMerchantWindow(
			ctx, msg.UserID,
			parsed.Bank, parsed.Type,
			int64(amount*100),
			strings.ToLower(strings.TrimSpace(parsed.Merchant)),
			after,
		)
		if err != nil {
			log.Printf("[AI-Full] dedup check error for msg %s: %v", msg.MessageID, err)
		} else if dup {
			return s.markSkipped(ctx, msg.ID, "duplicate (fuzzy match: same bank/type/amount/merchant within 2h)")
		}
	}

	tx, err := s.buildTransaction(ctx, msg, parsed)
	if err != nil {
		return s.markFailed(ctx, msg.ID, err.Error())
	}

	if err := s.txRepo.Create(ctx, tx); err != nil {
		if strings.Contains(err.Error(), "idempotency_key") ||
			strings.Contains(err.Error(), "unique constraint") {
			return s.markSkipped(ctx, msg.ID, "already imported (idempotency key conflict)")
		}
		return s.markFailed(ctx, msg.ID, err.Error())
	}

	var aiRawResult datatypes.JSON
	if b, jerr := json.Marshal(aiResult); jerr == nil {
		aiRawResult = datatypes.JSON(b)
	}

	now := time.Now()
	return s.msgRepo.UpdateStatus(ctx, msg.ID, map[string]interface{}{
		"parse_status":    "imported",
		"transaction_id":  tx.ID,
		"imported_at":     now,
		"parsed_bank":     "ai",
		"parsed_type":     parsed.Type,
		"parsed_amount":   parsed.Amount,
		"parsed_merchant": nullableStr(parsed.Merchant),
		"ai_used":         true,
		"ai_raw_result":   aiRawResult,
	})
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

// extractEmailDomain returns the domain part from an email address or display-name header.
// Handles both "email@domain.com" and "Name <email@domain.com>" formats.
func extractEmailDomain(from string) string {
	at := strings.LastIndex(from, "@")
	if at < 0 {
		return ""
	}
	domain := from[at+1:]
	if idx := strings.IndexAny(domain, "> \t"); idx >= 0 {
		domain = domain[:idx]
	}
	return strings.ToLower(strings.TrimSpace(domain))
}
