// Package emailparser provides email-to-transaction parsing for Indonesian banks and e-wallets.
// Each bank has a set of regex rules that extract: type, amount, merchant, account number, date.
package emailparser

import (
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
)

// ParsedTransaction is the output of a successful email parse.
type ParsedTransaction struct {
	Bank          string
	Type          string  // income | expense | transfer
	Amount        float64
	Merchant      string
	Description   string
	AccountNumber string
	Date          *time.Time
	RawFields     map[string]string
}

// ParseResult wraps the outcome of parsing one email.
type ParseResult struct {
	Matched bool
	Data    *ParsedTransaction
	Error   error
}

// Parse attempts to extract a transaction from an email subject + body.
// It tries all registered bank parsers in order and returns the first match.
func Parse(from, subject, bodyText, bodyHTML string) ParseResult {
	// Normalise inputs
	subject = strings.TrimSpace(subject)
	body := bodyText
	if body == "" {
		body = stripHTML(bodyHTML)
	}
	combined := subject + "\n" + body
	fromLower := strings.ToLower(from)
	subjectLower := strings.ToLower(subject)
	combinedLower := strings.ToLower(combined)

	for _, p := range allParsers {
		if p.Matches(fromLower, subjectLower, combinedLower) {
			result := p.Parse(from, subject, combined)
			if result.Matched {
				return result
			}
		}
	}
	return ParseResult{Matched: false}
}

// ─── Parser interface ────────────────────────────────────────────────────────

type bankParser interface {
	Matches(from, subject, combined string) bool
	Parse(from, subject, combined string) ParseResult
}

// allParsers is the ordered list of all bank/ewallet parsers.
var allParsers = []bankParser{
	&bcaParser{},
	&mandiriParser{},
	&briParser{},
	&bniParser{},
	&gopayParser{},
	&ovoParser{},
	&danaParser{},
	&shopeepayParser{},
	&jeniusParser{},
	&livinParser{},  // Mandiri Livin'
	&bsIParser{},    // BSI Mobile
	&cimbParser{},   // CIMB Niaga
	&permataParser{},
	&flipParser{},
	&linkAjaParser{},
	&danamonParser{},
	&btnParser{},
	&islatransParser{}, // generic catch-all for other banks
}

// ─── Helper utilities ────────────────────────────────────────────────────────

// parseAmount converts "1.500.000" or "1,500,000.50" or "1500000" → float64
func parseAmount(s string) (float64, bool) {
	s = strings.TrimSpace(s)
	// Remove currency symbols
	for _, prefix := range []string{"Rp", "IDR", "rp", "idr", "RP"} {
		s = strings.TrimPrefix(s, prefix)
	}
	s = strings.TrimSpace(s)
	// Handle Indonesian format: dots as thousands, comma as decimal
	// e.g. "1.500.000,50" → "1500000.50"
	if strings.Count(s, ".") > 1 || (strings.Contains(s, ".") && strings.Contains(s, ",")) {
		s = strings.ReplaceAll(s, ".", "")
		s = strings.ReplaceAll(s, ",", ".")
	} else {
		// Single dot could be decimal (1500000.50) or thousands (1.500.000)
		// If dot position from end is 3 chars, treat as thousands separator
		if idx := strings.Index(s, "."); idx != -1 && len(s)-idx-1 == 3 {
			s = strings.ReplaceAll(s, ".", "")
		}
		s = strings.ReplaceAll(s, ",", ".")
	}
	// Remove any remaining non-numeric except dot
	var clean strings.Builder
	for _, r := range s {
		if unicode.IsDigit(r) || r == '.' {
			clean.WriteRune(r)
		}
	}
	v, err := strconv.ParseFloat(clean.String(), 64)
	if err != nil {
		return 0, false
	}
	return v, true
}

// extractFirst returns the first named-group capture or empty string.
func extractFirst(re *regexp.Regexp, text string) string {
	m := re.FindStringSubmatch(text)
	if len(m) < 2 {
		return ""
	}
	return strings.TrimSpace(m[1])
}

// namedGroups returns a map of all named capture groups.
func namedGroups(re *regexp.Regexp, text string) map[string]string {
	match := re.FindStringSubmatch(text)
	result := map[string]string{}
	for i, name := range re.SubexpNames() {
		if name != "" && i < len(match) {
			result[name] = strings.TrimSpace(match[i])
		}
	}
	return result
}

func stripHTML(html string) string {
	// Simple tag stripper — good enough for email bodies
	re := regexp.MustCompile(`<[^>]+>`)
	text := re.ReplaceAllString(html, " ")
	// Decode common HTML entities
	replacer := strings.NewReplacer(
		"&amp;", "&", "&lt;", "<", "&gt;", ">",
		"&nbsp;", " ", "&#160;", " ",
		"&quot;", `"`, "&#39;", "'",
	)
	text = replacer.Replace(text)
	// Collapse whitespace
	spaceRe := regexp.MustCompile(`\s+`)
	return strings.TrimSpace(spaceRe.ReplaceAllString(text, " "))
}

func parseIDDate(s string) *time.Time {
	s = strings.TrimSpace(s)
	layouts := []string{
		"02/01/2006 15:04:05",
		"02/01/2006 15:04",
		"02-01-2006 15:04:05",
		"02-01-2006 15:04",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"02 Jan 2006 15:04:05",
		"02 January 2006",
		"2 January 2006",
		"02/01/2006",
		"02-01-2006",
		"2006-01-02",
	}
	loc, _ := time.LoadLocation("Asia/Jakarta")
	for _, layout := range layouts {
		t, err := time.ParseInLocation(layout, s, loc)
		if err == nil {
			return &t
		}
	}
	return nil
}

// ─── BCA ─────────────────────────────────────────────────────────────────────

type bcaParser struct{}

var (
	bcaFromPattern     = regexp.MustCompile(`(?i)(@klikbca\.com|@bca\.co\.id|mybca)`)
	bcaSubjectPattern  = regexp.MustCompile(`(?i)(informasi transaksi|notifikasi|debet|kredit|transfer|bca)`)
	bcaAmountRe        = regexp.MustCompile(`(?i)(?:sebesar|jumlah|nominal|amount)[:\s]+(?:Rp\.?\s*)?(?P<amount>[\d.,]+)`)
	bcaAmountRe2       = regexp.MustCompile(`(?i)Rp\.?\s*(?P<amount>[\d.,]+)`)
	bcaTypeDebitRe     = regexp.MustCompile(`(?i)(debet|debit|pembelian|pembayaran|transfer (keluar|ke)|belanja|tarik)`)
	bcaTypeKreditRe    = regexp.MustCompile(`(?i)(kredit|terima|masuk|transfer (masuk|dari)|top.up)`)
	bcaMerchantRe      = regexp.MustCompile(`(?i)(?:ke|kepada|merchant|toko|di)[:\s]+(?P<merchant>[^\n,;]{3,80})`)
	bcaAccRe           = regexp.MustCompile(`(?i)(?:rekening|rek|no\.?rek)[:\s]*(?P<acc>\d[\d\s-]{5,20})`)
	bcaDateRe          = regexp.MustCompile(`(?i)(?:tanggal|tgl|waktu|pada)[:\s]*(?P<date>\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)`)
)

func (p *bcaParser) Matches(from, subject, combined string) bool {
	// Must come from BCA domain — do not match based on body content alone
	return bcaFromPattern.MatchString(from)
}

func (p *bcaParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)

	txType := "expense"
	if bcaTypeKreditRe.MatchString(lower) {
		txType = "income"
	}
	if bcaTypeDebitRe.MatchString(lower) {
		txType = "expense"
	}

	amountStr := extractFirst(bcaAmountRe, combined)
	if amountStr == "" {
		amountStr = extractFirst(bcaAmountRe2, combined)
	}
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}

	merchant := extractFirst(bcaMerchantRe, combined)
	acc := extractFirst(bcaAccRe, combined)
	dateStr := extractFirst(bcaDateRe, combined)
	date := parseIDDate(dateStr)

	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank:          "BCA",
		Type:          txType,
		Amount:        amount,
		Merchant:      merchant,
		Description:   "BCA: " + subject,
		AccountNumber: acc,
		Date:          date,
		RawFields:     map[string]string{"subject": subject, "amount_raw": amountStr},
	}}
}

// ─── Mandiri ──────────────────────────────────────────────────────────────────

type mandiriParser struct{}

var (
	mandiriFromRe    = regexp.MustCompile(`(?i)(@bankmandiri\.co\.id|mandirimail|inforekening)`)
	mandiriSubjectRe = regexp.MustCompile(`(?i)(mandiri|informasi (debet|kredit)|e-statement)`)
	mandiriAmountRe  = regexp.MustCompile(`(?i)(?:nominal|jumlah|sebesar|debet|kredit)[:\s]+(?:Rp\.?\s*)?(?P<amount>[\d.,]+)`)
	mandiriAmountRe2 = regexp.MustCompile(`(?i)Rp\.?\s*(?P<amount>[\d.,]+)`)
	mandiriTypeRe    = regexp.MustCompile(`(?i)(debet|debit|pembayaran|transfer keluar|pembelian)`)
	mandiriCrRe      = regexp.MustCompile(`(?i)(kredit|masuk|diterima|transfer masuk)`)
	mandiriMerchRe   = regexp.MustCompile(`(?i)(?:ke|merchant|keterangan|berita)[:\s]+(?P<m>[^\n,;]{3,80})`)
	mandiriDateRe    = regexp.MustCompile(`(?i)(?:tanggal|tgl)[:\s]*(?P<date>\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}(?:\s+\d{2}:\d{2})?)`)
)

func (p *mandiriParser) Matches(from, subject, combined string) bool {
	return mandiriFromRe.MatchString(from)
}

func (p *mandiriParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if mandiriCrRe.MatchString(lower) && !mandiriTypeRe.MatchString(lower) {
		txType = "income"
	}

	amountStr := extractFirst(mandiriAmountRe, combined)
	if amountStr == "" {
		amountStr = extractFirst(mandiriAmountRe2, combined)
	}
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}

	merchant := extractFirst(mandiriMerchRe, combined)
	dateStr := extractFirst(mandiriDateRe, combined)

	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank:        "Mandiri",
		Type:        txType,
		Amount:      amount,
		Merchant:    merchant,
		Description: "Mandiri: " + subject,
		Date:        parseIDDate(dateStr),
		RawFields:   map[string]string{"subject": subject},
	}}
}

// ─── BRI ──────────────────────────────────────────────────────────────────────

type briParser struct{}

var (
	// Match official BRI notification domains only — exclude promo subdomains like kk.bri.co.id
	// Valid: info@bri.co.id, notifikasi@bri.co.id — Invalid: promo@kk.bri.co.id
	briFromRe    = regexp.MustCompile(`(?i)@bri\.co\.id`)
	briSubjectRe = regexp.MustCompile(`(?i)(bri|brimo|notifikasi (debit|kredit)|transaksi bri)`)
	briAmountRe  = regexp.MustCompile(`(?i)(?:sebesar|jumlah|Rp\.?)\s*(?P<amount>[\d.,]+)`)
	briTypeRe    = regexp.MustCompile(`(?i)(debit|debet|keluar|pembayaran|transfer ke|belanja)`)
	briCrRe      = regexp.MustCompile(`(?i)(kredit|masuk|diterima|transfer dari|top.?up)`)
	briMerchRe   = regexp.MustCompile(`(?i)(?:ke|keterangan|merchant)[:\s]+(?P<m>[^\n,;]{3,80})`)
	briDateRe    = regexp.MustCompile(`(?P<date>\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}(?::\d{2})?)`)
)

func (p *briParser) Matches(from, subject, combined string) bool {
	if !briFromRe.MatchString(from) {
		return false
	}
	// Exclude promo/marketing subdomains — only allow direct @bri.co.id or known notification addresses
	// e.g. reject promo@kk.bri.co.id (has subdomain before bri.co.id)
	promoSubdomains := regexp.MustCompile(`(?i)@[a-z]+\.bri\.co\.id`)
	return !promoSubdomains.MatchString(from)
}

func (p *briParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if briCrRe.MatchString(lower) {
		txType = "income"
	}
	amountStr := extractFirst(briAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	merchant := extractFirst(briMerchRe, combined)
	date := parseIDDate(extractFirst(briDateRe, combined))
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "BRI", Type: txType, Amount: amount,
		Merchant: merchant, Description: "BRI: " + subject, Date: date,
		RawFields: map[string]string{"subject": subject},
	}}
}

// ─── BNI ──────────────────────────────────────────────────────────────────────

type bniParser struct{}

var (
	bniFromRe    = regexp.MustCompile(`(?i)(@bni\.co\.id|bni46|notifikasi.bni)`)
	bniSubjectRe = regexp.MustCompile(`(?i)(bni|bank negara|notifikasi transaksi bni)`)
	bniAmountRe  = regexp.MustCompile(`(?i)(?:Rp\.?|nominal|jumlah)\s*(?P<amount>[\d.,]+)`)
	bniTypeRe    = regexp.MustCompile(`(?i)(debit|debet|keluar|pembelian|pembayaran)`)
	bniCrRe      = regexp.MustCompile(`(?i)(kredit|masuk|diterima|top.?up)`)
	bniMerchRe   = regexp.MustCompile(`(?i)(?:tujuan|ke|keterangan)[:\s]+(?P<m>[^\n,;]{3,80})`)
	bniDateRe    = regexp.MustCompile(`(?P<date>\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2})`)
)

func (p *bniParser) Matches(from, subject, combined string) bool {
	return bniFromRe.MatchString(from)
}

func (p *bniParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if bniCrRe.MatchString(lower) {
		txType = "income"
	}
	amountStr := extractFirst(bniAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	merchant := extractFirst(bniMerchRe, combined)
	date := parseIDDate(extractFirst(bniDateRe, combined))
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "BNI", Type: txType, Amount: amount,
		Merchant: merchant, Description: "BNI: " + subject, Date: date,
		RawFields: map[string]string{"subject": subject},
	}}
}

// ─── GoPay ────────────────────────────────────────────────────────────────────

type gopayParser struct{}

var (
	gopayFromRe    = regexp.MustCompile(`(?i)(@gojek\.com|@gopay\.co\.id|noreply.*gojek|noreply.*gopay)`)
	gopaySubjectRe = regexp.MustCompile(`(?i)(gopay|gojek|pembayaran berhasil|top.?up gopay|terima gopay)`)
	gopayAmountRe  = regexp.MustCompile(`(?i)(?:Rp\.?|sebesar|nominal)\s*(?P<amount>[\d.,]+)`)
	gopayTypeRe    = regexp.MustCompile(`(?i)(kamu (membayar|bayar|transfer ke)|pembayaran ke|keluar)`)
	gopayCrRe      = regexp.MustCompile(`(?i)(top.?up|terima|masuk|diterima dari|menerima)`)
	gopayMerchRe   = regexp.MustCompile(`(?i)(?:ke|kepada|di|merchant)[:\s]+(?P<m>[^\n\r,;]{3,80})`)
	gopayDateRe    = regexp.MustCompile(`(?P<date>\d{1,2}\s+\w+\s+\d{4}(?:,\s+\d{2}:\d{2})?)`)
)

func (p *gopayParser) Matches(from, subject, combined string) bool {
	return gopayFromRe.MatchString(from)
}

func (p *gopayParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if gopayCrRe.MatchString(lower) && !gopayTypeRe.MatchString(lower) {
		txType = "income"
	}
	amountStr := extractFirst(gopayAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	merchant := extractFirst(gopayMerchRe, combined)
	date := parseIDDate(extractFirst(gopayDateRe, combined))
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "GoPay", Type: txType, Amount: amount,
		Merchant: merchant, Description: "GoPay: " + subject, Date: date,
		RawFields: map[string]string{"subject": subject},
	}}
}

// ─── OVO ──────────────────────────────────────────────────────────────────────

type ovoParser struct{}

var (
	ovoFromRe    = regexp.MustCompile(`(?i)(@ovo\.id|noreply.*ovo|info.*ovo)`)
	ovoSubjectRe = regexp.MustCompile(`(?i)(ovo|pembayaran ovo|top.?up ovo|transfer ovo)`)
	ovoAmountRe  = regexp.MustCompile(`(?i)(?:Rp\.?|total|nominal)\s*(?P<amount>[\d.,]+)`)
	ovoTypeRe    = regexp.MustCompile(`(?i)(pembayaran|bayar|keluar|digunakan untuk)`)
	ovoCrRe      = regexp.MustCompile(`(?i)(top.?up|masuk|diterima|kamu menerima)`)
	ovoMerchRe   = regexp.MustCompile(`(?i)(?:ke|di|kepada)[:\s]+(?P<m>[^\n\r,;]{3,80})`)
)

func (p *ovoParser) Matches(from, subject, combined string) bool {
	return ovoFromRe.MatchString(from)
}

func (p *ovoParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if ovoCrRe.MatchString(lower) {
		txType = "income"
	}
	amountStr := extractFirst(ovoAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	merchant := extractFirst(ovoMerchRe, combined)
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "OVO", Type: txType, Amount: amount,
		Merchant: merchant, Description: "OVO: " + subject,
		RawFields: map[string]string{"subject": subject},
	}}
}

// ─── DANA ────────────────────────────────────────────────────────────────────

type danaParser struct{}

var (
	danaFromRe    = regexp.MustCompile(`(?i)(@dana\.id|noreply.*dana|info.*dana\.id)`)
	danaSubjectRe = regexp.MustCompile(`(?i)(dana|pembayaran dana|top.?up dana|transfer berhasil dana)`)
	danaAmountRe  = regexp.MustCompile(`(?i)(?:Rp\.?|nominal|total)\s*(?P<amount>[\d.,]+)`)
	danaTypeRe    = regexp.MustCompile(`(?i)(bayar|pembayaran|keluar|transfer ke)`)
	danaCrRe      = regexp.MustCompile(`(?i)(top.?up|masuk|menerima|diterima)`)
	danaMerchRe   = regexp.MustCompile(`(?i)(?:ke|kepada|di|merchant)[:\s]+(?P<m>[^\n\r,;]{3,80})`)
)

func (p *danaParser) Matches(from, subject, combined string) bool {
	return danaFromRe.MatchString(from)
}

func (p *danaParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if danaCrRe.MatchString(lower) {
		txType = "income"
	}
	amountStr := extractFirst(danaAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	merchant := extractFirst(danaMerchRe, combined)
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "DANA", Type: txType, Amount: amount,
		Merchant: merchant, Description: "DANA: " + subject,
		RawFields: map[string]string{"subject": subject},
	}}
}

// ─── ShopeePay ───────────────────────────────────────────────────────────────

type shopeepayParser struct{}

var (
	shopeeFromRe    = regexp.MustCompile(`(?i)(@shopee\.co\.id|noreply.*shopee|spay)`)
	shopeeSubjectRe = regexp.MustCompile(`(?i)(shopeepay|shopee pay|pembayaran shopee|top.?up spay)`)
	shopeeAmountRe  = regexp.MustCompile(`(?i)(?:Rp\.?|total|nominal)\s*(?P<amount>[\d.,]+)`)
	shopeeTypeRe    = regexp.MustCompile(`(?i)(pembayaran|bayar|digunakan|belanja)`)
	shopeeCrRe      = regexp.MustCompile(`(?i)(top.?up|masuk|diterima|cashback|refund)`)
	shopeeMerchRe   = regexp.MustCompile(`(?i)(?:di|ke|merchant)[:\s]+(?P<m>[^\n\r,;]{3,80})`)
)

func (p *shopeepayParser) Matches(from, subject, combined string) bool {
	return shopeeFromRe.MatchString(from)
}

func (p *shopeepayParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if shopeeCrRe.MatchString(lower) {
		txType = "income"
	}
	amountStr := extractFirst(shopeeAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	merchant := extractFirst(shopeeMerchRe, combined)
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "ShopeePay", Type: txType, Amount: amount,
		Merchant: merchant, Description: "ShopeePay: " + subject,
		RawFields: map[string]string{"subject": subject},
	}}
}

// ─── Jenius (BTPN) ────────────────────────────────────────────────────────────

type jeniusParser struct{}

var (
	jeniusFromRe    = regexp.MustCompile(`(?i)(@jenius\.com|@btpn\.com|noreply.*jenius)`)
	jeniusSubjectRe = regexp.MustCompile(`(?i)(jenius|btpn|$cashtag|send money|pay)`)
	jeniusAmountRe  = regexp.MustCompile(`(?i)(?:IDR|Rp\.?)\s*(?P<amount>[\d.,]+)`)
	jeniusTypeRe    = regexp.MustCompile(`(?i)(send|paid|pembayaran|keluar|debit)`)
	jeniusCrRe      = regexp.MustCompile(`(?i)(received|masuk|kredit|top.?up)`)
	jeniusMerchRe   = regexp.MustCompile(`(?i)(?:to|ke|dari|from)[:\s]+(?P<m>[^\n\r,;]{3,80})`)
)

func (p *jeniusParser) Matches(from, subject, combined string) bool {
	return jeniusFromRe.MatchString(from)
}

func (p *jeniusParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if jeniusCrRe.MatchString(lower) {
		txType = "income"
	}
	amountStr := extractFirst(jeniusAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	merchant := extractFirst(jeniusMerchRe, combined)
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "Jenius", Type: txType, Amount: amount,
		Merchant: merchant, Description: "Jenius: " + subject,
		RawFields: map[string]string{"subject": subject},
	}}
}

// ─── Livin' by Mandiri ────────────────────────────────────────────────────────

type livinParser struct{}

var (
	livinFromRe    = regexp.MustCompile(`(?i)(livin|@bankmandiri\.co\.id)`)
	livinSubjectRe = regexp.MustCompile(`(?i)(livin|mandiri online|notifikasi mandiri)`)
)

func (p *livinParser) Matches(from, subject, combined string) bool {
	return livinFromRe.MatchString(from)
}

func (p *livinParser) Parse(from, subject, combined string) ParseResult {
	// Re-use mandiri parser logic
	m := &mandiriParser{}
	result := m.Parse(from, subject, combined)
	if result.Matched && result.Data != nil {
		result.Data.Bank = "Mandiri Livin"
	}
	return result
}

// ─── BSI Mobile ───────────────────────────────────────────────────────────────

type bsIParser struct{}

var (
	bsiFromRe    = regexp.MustCompile(`(?i)(@bsm\.co\.id|@bankbsi\.co\.id|bsi.mobile)`)
	bsiSubjectRe = regexp.MustCompile(`(?i)(bsi|bank syariah indonesia|notifikasi bsi)`)
	bsiAmountRe  = regexp.MustCompile(`(?i)(?:Rp\.?|nominal|jumlah)\s*(?P<amount>[\d.,]+)`)
	bsiTypeRe    = regexp.MustCompile(`(?i)(debet|keluar|pembayaran|transfer ke)`)
	bsiCrRe      = regexp.MustCompile(`(?i)(kredit|masuk|diterima)`)
)

func (p *bsIParser) Matches(from, subject, combined string) bool {
	return bsiFromRe.MatchString(from)
}

func (p *bsIParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if bsiCrRe.MatchString(lower) {
		txType = "income"
	}
	amountStr := extractFirst(bsiAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "BSI", Type: txType, Amount: amount,
		Description: "BSI: " + subject,
		RawFields:   map[string]string{"subject": subject},
	}}
}

// ─── CIMB Niaga ───────────────────────────────────────────────────────────────

type cimbParser struct{}

var (
	cimbFromRe    = regexp.MustCompile(`(?i)(@cimbniaga\.co\.id|@cimb\.com|noreply.*cimb)`)
	cimbSubjectRe = regexp.MustCompile(`(?i)(cimb|octo|cimb niaga|notifikasi cimb)`)
	cimbAmountRe  = regexp.MustCompile(`(?i)(?:Rp\.?|IDR|sebesar)\s*(?P<amount>[\d.,]+)`)
	cimbTypeRe    = regexp.MustCompile(`(?i)(debit|keluar|pembayaran|pembelian)`)
	cimbCrRe      = regexp.MustCompile(`(?i)(kredit|masuk|diterima|top.?up)`)
)

func (p *cimbParser) Matches(from, subject, combined string) bool {
	return cimbFromRe.MatchString(from)
}

func (p *cimbParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if cimbCrRe.MatchString(lower) {
		txType = "income"
	}
	amountStr := extractFirst(cimbAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "CIMB Niaga", Type: txType, Amount: amount,
		Description: "CIMB: " + subject,
		RawFields:   map[string]string{"subject": subject},
	}}
}

// ─── Permata Bank ─────────────────────────────────────────────────────────────

type permataParser struct{}

var (
	permataFromRe    = regexp.MustCompile(`(?i)(@permatabank\.com|noreply.*permata)`)
	permataSubjectRe = regexp.MustCompile(`(?i)(permata|permatamobile|notifikasi permata)`)
	permataAmountRe  = regexp.MustCompile(`(?i)(?:Rp\.?|IDR|nominal)\s*(?P<amount>[\d.,]+)`)
)

func (p *permataParser) Matches(from, subject, combined string) bool {
	return permataFromRe.MatchString(from)
}

func (p *permataParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if strings.Contains(lower, "kredit") || strings.Contains(lower, "masuk") {
		txType = "income"
	}
	amountStr := extractFirst(permataAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "Permata", Type: txType, Amount: amount,
		Description: "Permata: " + subject,
		RawFields:   map[string]string{"subject": subject},
	}}
}

// ─── Flip ────────────────────────────────────────────────────────────────────

type flipParser struct{}

var (
	flipFromRe    = regexp.MustCompile(`(?i)(@flip\.id|noreply.*flip\.id)`)
	flipSubjectRe = regexp.MustCompile(`(?i)(flip|transfer via flip|flip berhasil)`)
	flipAmountRe  = regexp.MustCompile(`(?i)(?:Rp\.?|sebesar)\s*(?P<amount>[\d.,]+)`)
	flipMerchRe   = regexp.MustCompile(`(?i)(?:ke|kepada|tujuan)[:\s]+(?P<m>[^\n\r,;]{3,80})`)
)

func (p *flipParser) Matches(from, subject, combined string) bool {
	return flipFromRe.MatchString(from)
}

func (p *flipParser) Parse(from, subject, combined string) ParseResult {
	amountStr := extractFirst(flipAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	merchant := extractFirst(flipMerchRe, combined)
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "Flip", Type: "expense", Amount: amount,
		Merchant: merchant, Description: "Flip: " + subject,
		RawFields: map[string]string{"subject": subject},
	}}
}

// ─── LinkAja ──────────────────────────────────────────────────────────────────

type linkAjaParser struct{}

var (
	linkAjaFromRe    = regexp.MustCompile(`(?i)(@linkaja\.id|noreply.*linkaja|tcash)`)
	linkAjaSubjectRe = regexp.MustCompile(`(?i)(linkaja|link aja|tcash|notifikasi linkaja)`)
	linkAjaAmountRe  = regexp.MustCompile(`(?i)(?:Rp\.?|IDR|sebesar|nominal)\s*(?P<amount>[\d.,]+)`)
	linkAjaTypeRe    = regexp.MustCompile(`(?i)(pembayaran|bayar|keluar|transfer ke)`)
	linkAjaCrRe      = regexp.MustCompile(`(?i)(top.?up|masuk|diterima|cashback)`)
	linkAjaMerchRe   = regexp.MustCompile(`(?i)(?:ke|di|merchant)[:\s]+(?P<m>[^\n\r,;]{3,80})`)
)

func (p *linkAjaParser) Matches(from, subject, combined string) bool {
	return linkAjaFromRe.MatchString(from)
}

func (p *linkAjaParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if linkAjaCrRe.MatchString(lower) {
		txType = "income"
	}
	amountStr := extractFirst(linkAjaAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	merchant := extractFirst(linkAjaMerchRe, combined)
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "LinkAja", Type: txType, Amount: amount,
		Merchant: merchant, Description: "LinkAja: " + subject,
		RawFields: map[string]string{"subject": subject},
	}}
}

// ─── Bank Danamon ─────────────────────────────────────────────────────────────

type danamonParser struct{}

var (
	danamonFromRe    = regexp.MustCompile(`(?i)(@danamon\.co\.id|noreply.*danamon|d-bank)`)
	danamonSubjectRe = regexp.MustCompile(`(?i)(danamon|d-bank|notifikasi danamon|transaksi danamon)`)
	danamonAmountRe  = regexp.MustCompile(`(?i)(?:Rp\.?|IDR|nominal|jumlah|sebesar)\s*(?P<amount>[\d.,]+)`)
	danamonTypeRe    = regexp.MustCompile(`(?i)(debet|debit|pembayaran|keluar|transfer ke|tarik)`)
	danamonCrRe      = regexp.MustCompile(`(?i)(kredit|masuk|diterima|top.?up|setor)`)
	danamonMerchRe   = regexp.MustCompile(`(?i)(?:ke|keterangan|merchant|tujuan)[:\s]+(?P<m>[^\n\r,;]{3,80})`)
	danamonDateRe    = regexp.MustCompile(`(?i)(?:tanggal|tgl|waktu)[:\s]*(?P<date>\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}(?:\s+\d{2}:\d{2})?)`)
)

func (p *danamonParser) Matches(from, subject, combined string) bool {
	return danamonFromRe.MatchString(from)
}

func (p *danamonParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if danamonCrRe.MatchString(lower) && !danamonTypeRe.MatchString(lower) {
		txType = "income"
	}
	amountStr := extractFirst(danamonAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	merchant := extractFirst(danamonMerchRe, combined)
	date := parseIDDate(extractFirst(danamonDateRe, combined))
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "Danamon", Type: txType, Amount: amount,
		Merchant: merchant, Description: "Danamon: " + subject, Date: date,
		RawFields: map[string]string{"subject": subject},
	}}
}

// ─── Bank BTN ─────────────────────────────────────────────────────────────────

type btnParser struct{}

var (
	btnFromRe    = regexp.MustCompile(`(?i)(@btn\.co\.id|noreply.*btn|bankbtn)`)
	btnSubjectRe = regexp.MustCompile(`(?i)(btn|bank btn|bank tabungan negara|notifikasi btn)`)
	btnAmountRe  = regexp.MustCompile(`(?i)(?:Rp\.?|nominal|jumlah)\s*(?P<amount>[\d.,]+)`)
	btnTypeRe    = regexp.MustCompile(`(?i)(debet|debit|pembayaran|transfer ke|angsuran)`)
	btnCrRe      = regexp.MustCompile(`(?i)(kredit|masuk|diterima|setoran)`)
)

func (p *btnParser) Matches(from, subject, combined string) bool {
	return btnFromRe.MatchString(from)
}

func (p *btnParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if btnCrRe.MatchString(lower) && !btnTypeRe.MatchString(lower) {
		txType = "income"
	}
	amountStr := extractFirst(btnAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "BTN", Type: txType, Amount: amount,
		Description: "BTN: " + subject,
		RawFields:   map[string]string{"subject": subject},
	}}
}

// ─── Generic / Catch-all ─────────────────────────────────────────────────────
// Catches any email with a clear Rp amount pattern from a bank-like sender.

type islatransParser struct{}

var (
	genericBankFromRe = regexp.MustCompile(`(?i)(bank|finansial|fintech|@.*\.co\.id)`)
	genericAmountRe   = regexp.MustCompile(`(?i)Rp\.?\s*(?P<amount>[\d]{4,}[\d.,]*)`)
	genericTypeRe     = regexp.MustCompile(`(?i)(debet|debit|pembayaran|keluar|belanja|pembelian)`)
	genericCrRe       = regexp.MustCompile(`(?i)(kredit|masuk|diterima|top.?up|refund)`)
)

func (p *islatransParser) Matches(from, subject, combined string) bool {
	// Generic parser disabled — too many false positives.
	// Email must come from a known bank/ewallet domain (handled by specific parsers above).
	// Users can add custom rules via Settings > Parser Rules for unlisted banks.
	return false
}

func (p *islatransParser) Parse(from, subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if genericCrRe.MatchString(lower) && !genericTypeRe.MatchString(lower) {
		txType = "income"
	}
	amountStr := extractFirst(genericAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	// Extract bank name from from-address domain
	bankName := "Bank"
	if m := regexp.MustCompile(`@([^.]+)\.(co\.id|com|id)`).FindStringSubmatch(strings.ToLower(from)); len(m) > 1 {
		bankName = strings.Title(strings.ReplaceAll(m[1], "-", " "))
	}
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: bankName, Type: txType, Amount: amount,
		Description: bankName + ": " + subject,
		RawFields:   map[string]string{"subject": subject, "from": from},
	}}
}
