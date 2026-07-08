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
	Matched       bool
	IsAIOnly      bool  // DB rule matched but has no extraction config; delegate to AI
	MatchedRuleID uint  // ID of the matching DB rule (used for rule graduation after AI)
	Data          *ParsedTransaction
	Error         error
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
	&wondrParser{}, // BNI Wondr — before generic bniParser
	&bniParser{},
	&livinParser{},   // Mandiri Livin'
	&bsIParser{},     // BSI Mobile
	&cimbParser{},    // CIMB Niaga
	&permataParser{},
	&danamonParser{},
	&btnParser{},
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
		// Single dot: if 3 digits after it, it's a thousands separator ("1.500" → 1500)
		if idx := strings.Index(s, "."); idx != -1 && len(s)-idx-1 == 3 {
			s = strings.ReplaceAll(s, ".", "")
		}
		// Comma handling: Shopee (and some providers) use US format where comma = thousands.
		// Multiple commas → all thousands: "1,500,000" → "1500000"
		// Single comma 3-from-end → thousands: "72,000" / "62,395" → 72000 / 62395
		// Single comma NOT 3-from-end → decimal: "1,50" → "1.50"
		switch strings.Count(s, ",") {
		case 0:
			// nothing
		case 1:
			if idx := strings.Index(s, ","); len(s)-idx-1 == 3 {
				s = strings.ReplaceAll(s, ",", "") // thousands separator
			} else {
				s = strings.ReplaceAll(s, ",", ".") // decimal separator
			}
		default:
			s = strings.ReplaceAll(s, ",", "") // multiple commas → all thousands
		}
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
		"&#44;", ",",  // comma — used in BRImo date: "25 May 2026 &#44; 11:18:22 WIB"
	)
	text = replacer.Replace(text)
	// Collapse whitespace
	spaceRe := regexp.MustCompile(`\s+`)
	return strings.TrimSpace(spaceRe.ReplaceAllString(text, " "))
}

// idMonths translates Indonesian month names to English so parseIDDate can use standard Go layouts.
var idMonths = strings.NewReplacer(
	"Januari", "January", "Februari", "February", "Maret", "March",
	"April", "April", "Mei", "May", "Juni", "June", "Juli", "July",
	"Agustus", "August", "September", "September", "Oktober", "October",
	"November", "November", "Desember", "December",
)

func parseIDDate(s string) *time.Time {
	s = strings.TrimSpace(s)
	// Translate Indonesian month names (Mei, Januari, etc.) to English
	s = idMonths.Replace(s)
	// Normalise: remove timezone suffixes and stray commas/spaces
	// e.g. "26 May 2026 , 11:18:22 WIB" → "26 May 2026 11:18:22"
	tzRe := regexp.MustCompile(`(?i)\s*(WIB|WITA|WIT)\s*$`)
	s = tzRe.ReplaceAllString(s, "")
	s = strings.ReplaceAll(s, " ,", "")
	s = strings.ReplaceAll(s, ", ", " ")
	s = strings.ReplaceAll(s, ",", " ")
	// Collapse multiple spaces
	spRe := regexp.MustCompile(`\s{2,}`)
	s = spRe.ReplaceAllString(s, " ")
	s = strings.TrimSpace(s)

	layouts := []string{
		// 4-digit year formats
		"02/01/2006 15:04:05",
		"02/01/2006 15:04",
		"02-01-2006 15:04:05",
		"02-01-2006 15:04",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2 Jan 2006 15:04:05",
		"2 Jan 2006 15:04",
		"02 Jan 2006 15:04:05",
		"02 Jan 2006 15:04",
		"2 January 2006 15:04:05",
		"2 January 2006 15:04",
		"02 January 2006",
		"2 January 2006",
		// Dash-separated with 3-letter month (e.g. "16-May-2026" after ID→EN translation)
		"02-Jan-2006 15:04:05",
		"02-Jan-2006 15:04",
		"02-Jan-2006",
		"2-Jan-2006",
		"02/01/2006",
		"02-01-2006",
		"2006-01-02",
		// 2-digit year formats (BRI Notification: "07/05/26 03:28:12")
		"02/01/06 15:04:05",
		"02/01/06 15:04",
		"02/01/06",
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
	isDebit := bcaTypeDebitRe.MatchString(lower)
	isKredit := bcaTypeKreditRe.MatchString(lower)
	if isKredit && !isDebit {
		txType = "income"
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
	// Exclude Livin' emails — handled by dedicated livinParser
	if strings.Contains(strings.ToLower(from), "livin") {
		return false
	}
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
	briAmountRe  = regexp.MustCompile(`(?i)(?:(?:debit|kredit)\s*:\s*)?(?:sebesar|jumlah|nominal|Rp\.?|IDR\.?)\s*(?P<amount>[\d.,]+)`)
	briTypeRe    = regexp.MustCompile(`(?i)(debit|debet|keluar|pembayaran|transfer ke|belanja|pembelian|tarik tunai|penarikan)`)
	briCrRe      = regexp.MustCompile(`(?i)(kredit|masuk|diterima|transfer dari|top.?up|setoran|setor tunai)`)
	// "Ket.: QRIS-WARUNG MAKAN PADANG" or "Ket.: NBMB RENALDY TO FLIPTECH"
	briKetRe     = regexp.MustCompile(`(?i)Ket\.\s*:\s*(?P<ket>[^\n<]{3,120})`)
	briMerchRe   = regexp.MustCompile(`(?i)(?:ke|keterangan|merchant)[:\s]+(?P<m>[^\n,;]{3,80})`)
	// BRI format 1: "pada 07/05/26 03:28:12" (Notification BRI — DD/MM/YY or DD/MM/YYYY)
	// BRI format 2: "26 May 2026 , 11:18:22 WIB" (BRImo HTML email — decoded from &#44;)
	briDateRe    = regexp.MustCompile(`(?i)(?:pada\s+)?(?P<date>\d{2}/\d{2}/\d{2,4}\s+\d{2}:\d{2}(?::\d{2})?)`)
	// "Date 26 May 2026 , 11:18:22 WIB" (Transfer BRImo) or "Tanggal Transaksi  11 May 2026, 21:16:09 WIB" (QRIS BRImo)
	// Also handles pipe separator: "Tanggal 25 Jun 2026 | 08:50:01 WIB" (KK payment BRImo)
	briDateRe2   = regexp.MustCompile(`(?i)(?:Date|Tanggal(?:\s+Transaksi)?)\s+(?P<date>\d{1,2}\s+\w+\s+\d{4}\s*[,|،]?\s*\d{2}:\d{2}(?::\d{2})?\s*(?:WIB|WITA|WIT)?)`)
)

var briPromoSubdomainRe = regexp.MustCompile(`(?i)@[a-z]+\.bri\.co\.id`)

// ── BRI email subject categories ──────────────────────────────────────────────
// Each subject type has a dedicated parser to extract merchant correctly.
// Anti-double strategy: each real-money-movement has ONE canonical email type.
//
//   QRIS payment     → "Pembelian QRIS Berhasil"         (preferred, has merchant name)
//                      "Notification BRI" with Ket.: QRIS-... is SKIPPED
//   BRIVA payment    → "BRIVA Payment Successful"         (preferred)
//                      "Notification BRI" with Ket.: BRIVA... checked for duplicate
//   Transfer out     → "Transfer Between BRI Account" or "Pemindahan Dana Sesama Rekening BRI"
//                      "Notification BRI" with Ket.: NBMB...TO... is SKIPPED
//   Other debit      → "Notification BRI" (catch-all for anything not covered above)
//   Income/credit    → "Notification BRI" with credit keywords
var (
	briSubjectQRIS       = regexp.MustCompile(`(?i)^pembelian qris`)
	briSubjectBRIVA      = regexp.MustCompile(`(?i)^briva payment successful`)
	briSubjectTransfer   = regexp.MustCompile(`(?i)(transfer between bri|pemindahan dana sesama rekening bri|transfer to other domestic bank)`)
	briSubjectKK         = regexp.MustCompile(`(?i)(pembayaran kk bri|credit card)`)
	briSubjectNotif      = regexp.MustCompile(`(?i)^notification\s+bri`)

	// Ket. field patterns inside "Notification BRI"
	briKetQRISRe         = regexp.MustCompile(`(?i)Ket\.\s*:\s*QRIS`)
	briKetNBMBToRe       = regexp.MustCompile(`(?i)Ket\.\s*:\s*NBMB\s+.+?\s+TO\s+`)
	briKetBRIVARe        = regexp.MustCompile(`(?i)Ket\.\s*:\s*BRIVA\d+`)

	// Merchant extraction helpers
	// QRIS email: "Nama Merchant WARUNG MAKAN PADANG Lokasi Merchant..." — stop at "Lokasi"
	briQRISMerchantRe    = regexp.MustCompile(`(?i)Nama\s+Merchant\s+(?P<m>[^\n<]{3,60}?)(?:\s+Lokasi|\s+Nama\s+Penerbit|$)`)
	briQRISBodyAmountRe  = regexp.MustCompile(`(?i)(?:nominal|jumlah|total\s+transaksi|amount)[:\s]*(?:Rp\.?\s*)?(?P<amount>[\d.,]+)`)
	// Match recipient name, stop at "Notes", line break, or HTML tag
	briTransferToRe      = regexp.MustCompile(`(?i)(?:Recipient.s Name|Nama\s+(?:Penerima|Tujuan))[:\s]+(?P<m>[^\n<]{3,60}?)(?:\s+Notes|\s+Catatan|$)`)
	// BRIVA email has "Tujuan Pembayaran", "Merchant Name", or Ket.: BRIVA<digits>NBMB<name>
	briBRIVAMerchantRe   = regexp.MustCompile(`(?i)(?:Tujuan\s+Pembayaran|Merchant\s+Name|Merchant|Nama\s+Merchant)[:\s]+(?P<m>[^\n<]{3,80})`)

	// Ket.: field — full extraction
	briKetFullRe         = regexp.MustCompile(`(?i)Ket\.\s*:\s*(?P<ket>[^\n<]{3,120})`)
	briKetNoiseRe        = regexp.MustCompile(`(?i)\s+JANGAN\s+.*$`)
	briKetBRIVACleanRe   = regexp.MustCompile(`(?i)^BRIVA\d+NBMB`)
	briKetNBMBCleanRe    = regexp.MustCompile(`(?i)^NBMB\s+\S+\s+TO\s+`)
	briKetQRISCleanRe    = regexp.MustCompile(`(?i)^QRIS[-\s]+`)
)

// extractBRIKet extracts and cleans the Ket.: field from Notification BRI body.
// Returns empty string if Ket. is absent or only contains BRI privacy notice.
func extractBRIKet(combined string) string {
	ket := extractFirst(briKetFullRe, combined)
	if ket == "" {
		return ""
	}
	ket = briKetNoiseRe.ReplaceAllString(ket, "")
	ket = strings.TrimSpace(ket)
	// If Ket. started directly with BRI's privacy notice (no actual content), return empty
	if strings.HasPrefix(strings.ToUpper(ket), "JANGAN") {
		return ""
	}
	return ket
}

var briKetKKRe = regexp.MustCompile(`(?i)^KK\s+\d+`)  // "KK 436502..." → credit card payment

// briKKInlineRe matches the plain-text credit card usage notification format sent by BRI:
// "Kartu Kredit BRI 436502xxxxxx2609 di SHOPEE sejumlah Rp 34.000 pada 04-07-2026 12:51:19"
// Groups: merchant (store name), amount, date
var briKKInlineRe = regexp.MustCompile(`(?i)Kartu\s+Kredit\s+BRI\s+[\dXx*]+\s+di\s+(?P<merchant>[A-Za-z0-9][A-Za-z0-9 &'.,-]{1,60}?)\s+sejumlah\s+Rp\s*(?P<amount>[\d.,]+)\s+pada\s+(?P<date>\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2})`)

// extractBRINotifMerchant cleans the Ket. value into a readable merchant name.
func extractBRINotifMerchant(ket string) string {
	if ket == "" {
		return ""
	}
	// "BRIVA<digits>NBMB<name>" → name
	if briKetBRIVACleanRe.MatchString(ket) {
		parts := briKetBRIVACleanRe.Split(ket, 2)
		if len(parts) == 2 && strings.TrimSpace(parts[1]) != "" {
			return strings.TrimSpace(parts[1])
		}
		return "BRIVA"
	}
	// "NBMB SENDER NAME TO MERCHANT" → MERCHANT (already filtered in Matches, but clean anyway)
	if briKetNBMBCleanRe.MatchString(ket) {
		return strings.TrimSpace(briKetNBMBCleanRe.ReplaceAllString(ket, ""))
	}
	// "QRIS-MERCHANT" → MERCHANT
	if briKetQRISCleanRe.MatchString(ket) {
		return strings.TrimSpace(briKetQRISCleanRe.ReplaceAllString(ket, ""))
	}
	// "QRIS<digits>#<digits>" or "QRISRNS<digits>#<digits>" → just a reference number, no merchant name
	if matched, _ := regexp.MatchString(`(?i)^QRIS\w*\d+[#\d]*$`, ket); matched {
		return "QRIS"
	}
	// "KK 436502XXXXXXXX09NBMB..." → "Kartu Kredit"
	if briKetKKRe.MatchString(ket) {
		return "Kartu Kredit"
	}
	// "SETORTUNAI#..." → "Setor Tunai"
	if strings.HasPrefix(strings.ToUpper(ket), "SETORTUNAI") {
		return "Setor Tunai"
	}
	// "BFST..." → bank transfer masuk
	if strings.HasPrefix(strings.ToUpper(ket), "BFST") {
		// Try extract name after pattern like "BFST... NBMB:NAME"
		if idx := strings.Index(strings.ToUpper(ket), "NBMB:"); idx != -1 {
			name := strings.TrimSpace(ket[idx+5:])
			if name != "" {
				return name
			}
		}
		return "Transfer Masuk"
	}
	// Remove trailing noise (hash codes, long alphanumeric IDs)
	noiseRe := regexp.MustCompile(`\s+[A-F0-9]{8,}.*$`)
	cleaned := strings.TrimSpace(noiseRe.ReplaceAllString(ket, ""))
	if cleaned != "" {
		return cleaned
	}
	return ket
}

func (p *briParser) Matches(from, subject, combined string) bool {
	if !briFromRe.MatchString(from) {
		return false
	}
	// Reject promo subdomains (kk.bri.co.id, dll)
	if briPromoSubdomainRe.MatchString(from) {
		return false
	}
	subj := strings.TrimSpace(subject)

	// ── Strategy: "Notification BRI" is the canonical source for all debit/credit.
	// It always contains the actual transaction date in body ("pada DD/MM/YY HH:MM:SS").
	// Other BRI email types (BRIVA Payment, Transfer Between BRI, KK, Pemindahan) are
	// SUPPLEMENTARY — they only get imported if they contain unique info not in Notification BRI,
	// specifically: QRIS (has merchant name not in Notification BRI).
	// Everything else is dedup'd by the idempotency key (bank+type+amount+tx_date).

	// QRIS: import from "Pembelian QRIS Berhasil" — has merchant name, has tx date in body
	if briSubjectQRIS.MatchString(subj) {
		return true
	}

	// Notification BRI: canonical source for all BRI transactions.
	// Accept ALL Notification BRI emails — the datetime-based idempotency key handles
	// dedup with "Pembelian QRIS Berhasil" or other supplementary emails if both arrive.
	if briSubjectNotif.MatchString(subj) {
		return true
	}

	// Supplementary transfer emails:
	// - BRIVA Payment → skip (Notification BRI Ket.: BRIVA... is canonical, has correct tx date)
	// - Transfer Between BRI / Pemindahan Dana → RE-ENABLED: has recipient name which Notification BRI
	//   may not always have cleanly. Idempotency key (bank+type+amount+date+merchant) prevents
	//   double-import when Notification BRI is also present for the same transaction.
	if briSubjectBRIVA.MatchString(subj) {
		return false
	}
	if briSubjectTransfer.MatchString(subj) {
		return true
	}

	return false
}

func (p *briParser) Parse(from, subject, combined string) ParseResult {
	subj := strings.TrimSpace(subject)

	// ── QRIS: "Pembelian QRIS Berhasil" ───────────────────────────────────────
	if briSubjectQRIS.MatchString(subj) {
		return p.parseQRIS(subject, combined)
	}

	// ── BRIVA: "BRIVA Payment Successful" ─────────────────────────────────────
	if briSubjectBRIVA.MatchString(subj) {
		return p.parseBRIVA(subject, combined)
	}

	// ── Transfer out ──────────────────────────────────────────────────────────
	if briSubjectTransfer.MatchString(subj) {
		return p.parseTransfer(subject, combined)
	}

	// ── KK / Credit card payment ──────────────────────────────────────────────
	if briSubjectKK.MatchString(subj) {
		return p.parseKK(subject, combined)
	}

	// ── Notification BRI (catch-all) ──────────────────────────────────────────
	return p.parseNotification(subject, combined)
}

func (p *briParser) parseQRIS(subject, combined string) ParseResult {
	// Try body amount (more specific field), fallback to generic
	amountStr := extractFirst(briQRISBodyAmountRe, combined)
	if amountStr == "" {
		amountStr = extractFirst(briAmountRe, combined)
	}
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	merchant := extractFirst(briQRISMerchantRe, combined)
	dateStr := extractFirst(briDateRe, combined)
	if dateStr == "" {
		dateStr = extractFirst(briDateRe2, combined)
	}
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "BRI", Type: "expense", Amount: amount,
		Merchant: merchant, Description: "BRI QRIS: " + merchant,
		Date: parseIDDate(dateStr),
		RawFields: map[string]string{"subject": subject, "email_type": "qris"},
	}}
}

func (p *briParser) parseBRIVA(subject, combined string) ParseResult {
	amountStr := extractFirst(briAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	merchant := extractFirst(briBRIVAMerchantRe, combined)
	dateStr := extractFirst(briDateRe2, combined)
	if dateStr == "" {
		dateStr = extractFirst(briDateRe, combined)
	}
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "BRI", Type: "expense", Amount: amount,
		Merchant: merchant, Description: "BRI BRIVA: " + merchant,
		Date: parseIDDate(dateStr),
		RawFields: map[string]string{"subject": subject, "email_type": "briva"},
	}}
}

func (p *briParser) parseTransfer(subject, combined string) ParseResult {
	amountStr := extractFirst(briAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	merchant := extractFirst(briTransferToRe, combined)
	dateStr := extractFirst(briDateRe2, combined)
	if dateStr == "" {
		dateStr = extractFirst(briDateRe, combined)
	}
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "BRI", Type: "expense", Amount: amount,
		Merchant: merchant, Description: "BRI Transfer: " + merchant,
		Date: parseIDDate(dateStr),
		RawFields: map[string]string{"subject": subject, "email_type": "transfer"},
	}}
}

func (p *briParser) parseKK(subject, combined string) ParseResult {
	amountStr := extractFirst(briAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	dateStr := extractFirst(briDateRe2, combined)
	if dateStr == "" {
		dateStr = extractFirst(briDateRe, combined)
	}
	// Extract card number for merchant detail: "Nomor Kartu 4365020209332609" → last 4 digits
	cardRe := regexp.MustCompile(`(?i)(?:Nomor\s+Kartu|Card\s+Number)[:\s]+(\d[\d\s*]+)`)
	cardNum := ""
	if m := cardRe.FindStringSubmatch(combined); len(m) > 1 {
		raw := strings.ReplaceAll(m[1], " ", "")
		if len(raw) >= 4 {
			cardNum = " ••" + raw[len(raw)-4:]
		}
	}
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		// type=transfer: this is paying off a credit card liability, not a new expense.
		// The actual spending was already recorded when the individual transactions occurred.
		Bank: "BRI", Type: "transfer", Amount: amount,
		Merchant:    "Bayar KK BRI" + cardNum,
		Description: "Pembayaran Kartu Kredit BRI",
		Date:        parseIDDate(dateStr),
		RawFields:   map[string]string{"subject": subject, "email_type": "kk_payment"},
	}}
}

func (p *briParser) parseNotification(subject, combined string) ParseResult {
	lower := strings.ToLower(combined)
	txType := "expense"
	if briCrRe.MatchString(lower) && !briTypeRe.MatchString(lower) {
		txType = "income"
	}

	// ── Inline credit card usage format ──────────────────────────────────────
	// "Kartu Kredit BRI 436502xxxxxx2609 di SHOPEE sejumlah Rp 34.000 pada 04-07-2026 12:51:19"
	// This format has no Ket.: field — merchant and amount are embedded inline.
	if kkGroups := namedGroups(briKKInlineRe, combined); kkGroups["merchant"] != "" {
		amount, ok := parseAmount(kkGroups["amount"])
		if ok && amount > 0 {
			return ParseResult{Matched: true, Data: &ParsedTransaction{
				Bank:     "BRI",
				Type:     "expense", // credit card spending = expense
				Amount:   amount,
				Merchant: strings.TrimSpace(kkGroups["merchant"]),
				Description: "BRI KK: " + strings.TrimSpace(kkGroups["merchant"]),
				Date:     parseIDDate(kkGroups["date"]),
				RawFields: map[string]string{"subject": subject, "email_type": "kk_inline"},
			}}
		}
	}

	amountStr := extractFirst(briAmountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}
	ket := extractBRIKet(combined)
	merchant := extractBRINotifMerchant(ket)
	// Ket.: KK... = credit card payment → reclassify as transfer (bank → credit card liability)
	if briKetKKRe.MatchString(ket) {
		txType = "transfer"
	}
	dateStr := extractFirst(briDateRe, combined)
	if dateStr == "" {
		dateStr = extractFirst(briDateRe2, combined)
	}
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank: "BRI", Type: txType, Amount: amount,
		Merchant: merchant, Description: "BRI: " + subject,
		Date: parseIDDate(dateStr),
		RawFields: map[string]string{"subject": subject, "email_type": "notification", "ket": ket},
	}}
}

// ─── BNI Wondr ────────────────────────────────────────────────────────────────
// Dedicated parser for wondr by BNI emails (wondr@bni.co.id).
// The HTML format differs significantly from classic BNI emails: merchant/recipient
// is in a "Penerima" block, amount is in a "Total" line, and dates use Indonesian
// month names (e.g. "03 Mei 2026", "16-Mei-2026").

type wondrParser struct{}

var (
	wondrFromRe       = regexp.MustCompile(`(?i)wondr@bni\.co\.id`)
	wondrAmountRe     = regexp.MustCompile(`(?i)Total\s+Rp\.?\s*(?P<amount>[\d.,]+)`)
	wondrAmountRe2    = regexp.MustCompile(`(?i)Nominal\s+Rp\.?\s*(?P<amount>[\d.,]+)`)
	wondrAmountRe3    = regexp.MustCompile(`(?i)Rp\.?\s*(?P<amount>[\d.,]+)`)
	wondrMerchRe      = regexp.MustCompile(`(?i)Penerima\s+(?P<m>[A-Za-z0-9][A-Za-z0-9 '&.,-]{1,50}?)\s+(?:Sumber dana|•|\*{3,}|\b(?:BNI|Mandiri|ShopeePay|GoPay|OVO|DANA|LinkAja|Finpay|Midtrans|Telkomsel|Pulsa)\b)`)
	wondrTopupWalletRe = regexp.MustCompile(`(?i)\b(ShopeePay|GoPay|OVO|DANA|LinkAja)\b`)
	wondrDateRe       = regexp.MustCompile(`(?i)Tanggal\s+(?P<date>\d{1,2}[\s\-]\w+[\s\-]\d{4})`)
	wondrTimeRe       = regexp.MustCompile(`(?i)Waktu\s+(?P<time>\d{2}:\d{2}(?::\d{2})?)`)
)

func (p *wondrParser) Matches(from, subject, combined string) bool {
	return wondrFromRe.MatchString(strings.ToLower(from))
}

func (p *wondrParser) Parse(from, subject, combined string) ParseResult {
	// Amount: Total (final) > Nominal > Rp fallback
	amountStr := extractFirst(wondrAmountRe, combined)
	if amountStr == "" {
		amountStr = extractFirst(wondrAmountRe2, combined)
	}
	if amountStr == "" {
		amountStr = extractFirst(wondrAmountRe3, combined)
	}
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}

	// Merchant from "Penerima" block.
	// For top-up emails the "Penerima" name is a masked version of the user — use wallet name instead.
	subjectLower := strings.ToLower(subject)
	var merchant string
	if strings.Contains(subjectLower, "top-up") || strings.Contains(subjectLower, "top up") {
		if m := wondrTopupWalletRe.FindString(combined); m != "" {
			merchant = m
		}
	}
	if merchant == "" {
		merchant = strings.TrimSpace(extractFirst(wondrMerchRe, combined))
	}

	// Date + Time extracted separately and combined.
	dateStr := extractFirst(wondrDateRe, combined)
	timeStr := extractFirst(wondrTimeRe, combined)
	if dateStr != "" && timeStr != "" {
		dateStr = dateStr + " " + timeStr
	}
	date := parseIDDate(dateStr)

	// All Wondr notification emails (Transaksi/Transfer/Top-up berhasil) are
	// outgoing from the user's BNI account, so always expense.
	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank:        "BNI Wondr",
		Type:        "expense",
		Amount:      amount,
		Merchant:    merchant,
		Description: "BNI Wondr: " + subject,
		Date:        date,
		RawFields:   map[string]string{"subject": subject},
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
	if bniCrRe.MatchString(lower) && !bniTypeRe.MatchString(lower) {
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

// ─── Livin' by Mandiri ────────────────────────────────────────────────────────
// Emails come from noreply.livin@bankmandiri.co.id with HTML structure that uses
// a "Penerima" block (not "ke:/keterangan:") and Indonesian date formats.

type livinParser struct{}

var (
	livinFromRe   = regexp.MustCompile(`(?i)(noreply\.livin@bankmandiri\.co\.id|livin[^@]*@bankmandiri\.co\.id)`)
	livinAmountRe = regexp.MustCompile(`(?i)(?:Nominal\s+Transaksi|Nominal\s+Pembayaran|Nominal)\s+Rp\.?\s*(?P<amount>[\d.,]+)`)
	livinAmountRe2 = regexp.MustCompile(`(?i)Rp\.?\s*(?P<amount>[\d.,]+)`)
	// Merchant: text after "Penerima", stops before city code ("TANGSEL - ID"),
	// bank name ("Bank Mandiri"), or long digit sequence (account number).
	livinMerchRe  = regexp.MustCompile(`(?i)Penerima\s+(?P<m>[A-Za-z0-9][A-Za-z0-9 '&.,-]{1,50}?)\s+(?:Sumber|Tanggal|Bank\s+Mandiri|Bank\s+BCA|Bank\s+BRI|\d{6,}|[A-Z]{3,8}\s*-\s*ID\b)`)
	livinDateRe   = regexp.MustCompile(`(?i)Tanggal\s+(?P<date>\d{1,2}[\s\-]\w+[\s\-]\d{4})`)
	livinTimeRe   = regexp.MustCompile(`(?i)Jam\s+(?P<time>\d{2}:\d{2}(?::\d{2})?)`)
)

func (p *livinParser) Matches(from, subject, combined string) bool {
	return livinFromRe.MatchString(from)
}

func (p *livinParser) Parse(from, subject, combined string) ParseResult {
	amountStr := extractFirst(livinAmountRe, combined)
	if amountStr == "" {
		amountStr = extractFirst(livinAmountRe2, combined)
	}
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}

	merchant := strings.TrimSpace(extractFirst(livinMerchRe, combined))
	// Discard QRIS technical noise (PAN / acquirer data) that occasionally leaks in
	if strings.HasPrefix(strings.ToUpper(merchant), "PAN ") {
		merchant = ""
	}

	dateStr := extractFirst(livinDateRe, combined)
	timeStr := extractFirst(livinTimeRe, combined)
	if dateStr != "" && timeStr != "" {
		dateStr = dateStr + " " + timeStr
	}
	date := parseIDDate(dateStr)

	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank:        "Mandiri Livin",
		Type:        "expense",
		Amount:      amount,
		Merchant:    merchant,
		Description: "Mandiri Livin: " + subject,
		Date:        date,
		RawFields:   map[string]string{"subject": subject},
	}}
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
	if bsiCrRe.MatchString(lower) && !bsiTypeRe.MatchString(lower) {
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
	if cimbCrRe.MatchString(lower) && !cimbTypeRe.MatchString(lower) {
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
