package usecase

import (
	"context"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/fintrackr/api/internal/infrastructure/ocr"
)

type paymentSlipUseCase struct {
	ocrClient *ocr.Client
}

// NewPaymentSlipUseCase creates a new PaymentSlipUseCase backed by the given OCR client.
func NewPaymentSlipUseCase(ocrClient *ocr.Client) domainuc.PaymentSlipUseCase {
	return &paymentSlipUseCase{ocrClient: ocrClient}
}

func (uc *paymentSlipUseCase) ScanSlip(ctx context.Context, in domainuc.ScanSlipInput) (*domainuc.ParsedSlip, error) {
	extracted, err := uc.ocrClient.Extract(ctx, in.ImageBytes, in.Filename)
	if err != nil {
		return nil, domainuc.ErrOCRServiceUnavailable
	}
	return parseSlipText(extracted.Text, extracted.Confidence), nil
}

// ─── Text parser ─────────────────────────────────────────────────────────────

var (
	// Inline amount: "Rp 646.912" or "IDR 646,912"
	reAmountInline = regexp.MustCompile(`(?i)(?:Rp\.?|IDR)\s*([\d.,]+)`)

	// ── Amount: label-priority patterns ──────────────────────────────────────
	// Matches "TOTAL SALES", "TOTAL BAYAR", "GRAND TOTAL", etc. optionally
	// followed by an amount on the SAME line (e.g. "TOTAL BAYAR Rp 646.912")
	reAmountLabelSameLine = regexp.MustCompile(
		`(?i)(?:total\s+sales|total\s+bayar|grand\s+total|total\s+pembayaran|` +
			`jumlah\s+bayar|jumlah\s+dibayar|charged\s+amount|total\s+tagihan)` +
			`[^0-9\n\r]{0,30}([\d.,]{4,})`)

	// Payment method lines: "QRIS 646.912", "DEBIT 646.912", "TUNAI 646.912"
	reAmountPaymentLine = regexp.MustCompile(
		`(?i)(?:^|\n)\s*(?:qris|debit|tunai|cash|kartu\s+kredit|kredit)\s*[:\s]+` +
			`(?:Rp\.?\s*)?([\d.,]{4,})`)

	// Standalone number on its own line (used as next-line fallback)
	reStandaloneNumber = regexp.MustCompile(`^[\s\t]*([\d.,]{4,})[\s\t]*$`)

	// Indonesian full date: "15 Januari 2026"
	reDate1 = regexp.MustCompile(`(?i)\b(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})\b`)
	// DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
	reDate2 = regexp.MustCompile(`\b(\d{2})[/\-.](\d{2})[/\-.](\d{4})\b`)
	// ISO YYYY-MM-DD
	reDate3 = regexp.MustCompile(`\b(\d{4})-(\d{2})-(\d{2})\b`)

	// Labeled merchant: "nama merchant: X", "toko: X", "kepada: X", etc.
	reMerchantLabel = regexp.MustCompile(
		`(?i)(?:nama\s+merchant|merchant\s*:?|toko\s*:?|nama\s+toko\s*:?|` +
			`kepada\s*:?|beneficiary\s*:?)\s*([^\n\r]{2,50})`)

	reAccNum = regexp.MustCompile(`\b(\d{8,16})\b`)

	// Noise words — lines containing these are NOT merchant candidates
	// Covers bank names, receipt header words, address words
	merchantNoiseWords = []string{
		"sales", "receipt", "invoice", "faktur", "pajak", "npwp", "subtotal",
		"total", "grand", "bayar", "tagihan", "kembalian", "penghematan",
		"diskon", "discount", "member", "struk", "nota", "bukti", "transfer",
		"debit", "kredit", "qris", "tunai", "cash", "bank", "mandiri", "bca",
		"bri", "bni", "bsi", "cimb", "danamon", "permata", "gopay", "ovo",
		"dana", "shopee", "linkaja", "flip", "jenius", "telp", "fax", "jl.",
		"jln", "no.", "npwp", "alamat", "address", "phone", "email",
	}

	indonesianMonths = map[string]time.Month{
		"januari": time.January, "februari": time.February,
		"maret": time.March, "april": time.April,
		"mei": time.May, "juni": time.June,
		"juli": time.July, "agustus": time.August,
		"september": time.September, "oktober": time.October,
		"november": time.November, "desember": time.December,
	}

	bankKeywords = []struct{ keyword, name string }{
		{"mandiri", "Mandiri"}, {"livin", "Mandiri"}, {"bca", "BCA"},
		{"bri", "BRI"}, {"bni", "BNI"}, {"wondr", "BNI"},
		{"cimb", "CIMB"}, {"danamon", "Danamon"}, {"permata", "Permata"},
		{"btn ", "BTN"}, {"bsi", "BSI"}, {"gopay", "GoPay"},
		{"ovo", "OVO"}, {"dana", "DANA"}, {"shopeepay", "ShopeePay"},
		{"shopee", "ShopeePay"}, {"linkaja", "LinkAja"}, {"flip", "Flip"},
		{"jenius", "Jenius"}, {"btpn", "Jenius"},
	}

	expenseKeywords = []string{
		"debet", "debit", "pembayaran", "transfer keluar", "penarikan",
		"tarik tunai", "pembelian", "belanja", "total sales", "total bayar",
	}
	incomeKeywords = []string{
		"kredit", "credit", "transfer masuk", "uang masuk", "setoran",
		"diterima", "top up", "topup",
	}
)

func parseSlipText(text string, confidence float64) *domainuc.ParsedSlip {
	lower := strings.ToLower(text)
	lines := strings.Split(text, "\n")

	slip := &domainuc.ParsedSlip{
		RawText:    text,
		Confidence: confidence,
	}

	// ── Amount ────────────────────────────────────────────────────────────────
	// Priority 1: "TOTAL SALES / TOTAL BAYAR / GRAND TOTAL" + amount same line
	slip.Amount = extractLabeledAmount(text, lines)

	// Priority 2: fallback to largest inline Rp value
	if slip.Amount == 0 {
		matches := reAmountInline.FindAllStringSubmatch(text, -1)
		var maxAmount float64
		for _, m := range matches {
			if v := parseIDRAmount(m[1]); v > maxAmount {
				maxAmount = v
			}
		}
		slip.Amount = maxAmount
	}

	// ── Date ──────────────────────────────────────────────────────────────────
	// Only match dates that appear BEFORE the subtotal/total section to avoid
	// false matches from barcode numbers or promo validity dates.
	dateSearchText := textBeforeTotal(text)
	if dateSearchText == "" {
		dateSearchText = text // no total marker found, search whole text
	}
	dateLower := strings.ToLower(dateSearchText)

	if m := reDate1.FindStringSubmatch(dateLower); m != nil {
		day, _ := strconv.Atoi(m[1])
		month := indonesianMonths[m[2]]
		year, _ := strconv.Atoi(m[3])
		t := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
		slip.Date = &t
	} else if m := reDate2.FindStringSubmatch(dateSearchText); m != nil {
		day, _ := strconv.Atoi(m[1])
		month, _ := strconv.Atoi(m[2])
		year, _ := strconv.Atoi(m[3])
		if month >= 1 && month <= 12 && day >= 1 && day <= 31 {
			t := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
			slip.Date = &t
		}
	} else if m := reDate3.FindStringSubmatch(dateSearchText); m != nil {
		year, _ := strconv.Atoi(m[1])
		month, _ := strconv.Atoi(m[2])
		day, _ := strconv.Atoi(m[3])
		t := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
		slip.Date = &t
	}

	// ── Merchant ──────────────────────────────────────────────────────────────
	// Priority 1: labeled line ("nama merchant: X")
	if m := reMerchantLabel.FindStringSubmatch(text); m != nil {
		slip.Merchant = strings.TrimSpace(m[1])
	}
	// Priority 2: header-line fallback — first short non-noise line in OCR output
	if slip.Merchant == "" {
		slip.Merchant = extractHeaderMerchant(lines)
	}

	// ── Bank ──────────────────────────────────────────────────────────────────
	for _, b := range bankKeywords {
		if strings.Contains(lower, b.keyword) {
			slip.Bank = b.name
			break
		}
	}

	// ── Transaction type ──────────────────────────────────────────────────────
	for _, kw := range expenseKeywords {
		if strings.Contains(lower, kw) {
			slip.Type = "expense"
			break
		}
	}
	if slip.Type == "" {
		for _, kw := range incomeKeywords {
			if strings.Contains(lower, kw) {
				slip.Type = "income"
				break
			}
		}
	}
	if slip.Type == "" {
		slip.Type = "expense"
	}

	// ── Account number ────────────────────────────────────────────────────────
	amountStr := strconv.FormatInt(int64(slip.Amount), 10)
	for _, m := range reAccNum.FindAllStringSubmatch(text, -1) {
		candidate := m[1]
		if candidate != amountStr && !strings.Contains(amountStr, candidate) {
			slip.AccountNumber = candidate
			break
		}
	}

	return slip
}

// extractLabeledAmount finds the actual paid amount by looking for priority
// label lines (TOTAL SALES, TOTAL BAYAR, QRIS, DEBIT, TUNAI) and reading
// the amount either on the same line or the immediately following line.
// This handles supermarket receipts where amount and label are on separate lines.
func extractLabeledAmount(text string, lines []string) float64 {
	// Try same-line label match first
	if m := reAmountLabelSameLine.FindStringSubmatch(text); m != nil {
		if v := parseIDRAmount(m[1]); v > 0 {
			return v
		}
	}
	if m := reAmountPaymentLine.FindStringSubmatch(text); m != nil {
		if v := parseIDRAmount(m[1]); v > 0 {
			return v
		}
	}

	// Try next-line: scan each line for a total/payment label,
	// then check the following line for a standalone number.
	totalLabels := []string{
		"total sales", "total bayar", "grand total", "total pembayaran",
		"jumlah bayar", "jumlah dibayar", "charged amount", "total tagihan",
	}
	// Labels that must NOT match (subtotal variants, even if OCR misreads them)
	excludeLabels := []string{"subtotal", "surtotal", "sub total"}
	paymentLabels := []string{"qris", "debit", "tunai", "cash"}

	for i, line := range lines {
		lineLower := strings.ToLower(strings.TrimSpace(line))

		isTotal := false
		for _, lbl := range totalLabels {
			if strings.Contains(lineLower, lbl) {
				// Make sure it's not a subtotal line
				isExcluded := false
				for _, excl := range excludeLabels {
					if strings.Contains(lineLower, excl) {
						isExcluded = true
						break
					}
				}
				if !isExcluded {
					isTotal = true
				}
				break
			}
		}
		if !isTotal {
			for _, lbl := range paymentLabels {
				// payment label line must be short (just the method + optional amount)
				// to avoid matching product names that happen to contain these words
				if strings.HasPrefix(lineLower, lbl) {
					isTotal = true
					break
				}
			}
		}

		if !isTotal {
			continue
		}

		// Check same line first (label and amount on same line, no "Rp" prefix)
		// e.g. "TOTAL SALES 646,912" or "QRIS 646,912"
		parts := strings.Fields(line)
		for _, p := range parts {
			p = strings.Trim(p, "Rp.,:;")
			if v := parseIDRAmount(p); v >= 100 { // ignore tiny noise numbers
				return v
			}
		}

		// Check next line for standalone number
		if i+1 < len(lines) {
			nextLine := strings.TrimSpace(lines[i+1])
			if m := reStandaloneNumber.FindStringSubmatch(nextLine); m != nil {
				if v := parseIDRAmount(m[1]); v >= 100 {
					return v
				}
			}
			// Also try stripping "Rp" prefix from next line
			nextClean := strings.TrimSpace(strings.TrimPrefix(
				strings.TrimPrefix(strings.ToLower(nextLine), "rp."), "rp"))
			if v := parseIDRAmount(nextClean); v >= 100 {
				return v
			}
		}
	}

	return 0
}

// textBeforeTotal returns the portion of OCR text before the subtotal/total
// section. Used to narrow date search and avoid false matches.
func textBeforeTotal(text string) string {
	markers := []string{
		"SUBTOTAL", "SUB TOTAL", "TOTAL SALES", "TOTAL BAYAR",
		"GRAND TOTAL", "TOTAL PEMBAYARAN",
	}
	lower := strings.ToLower(text)
	earliest := len(text)
	for _, m := range markers {
		if idx := strings.Index(lower, strings.ToLower(m)); idx != -1 && idx < earliest {
			earliest = idx
		}
	}
	if earliest == len(text) {
		return ""
	}
	return text[:earliest]
}

// extractHeaderMerchant scans the first lines of OCR output for a store name.
// Strategy: the merchant name is typically the first short, non-numeric,
// non-address, non-noise line at the top of the receipt.
func extractHeaderMerchant(lines []string) string {
	for i, line := range lines {
		if i >= 8 { // only check first 8 lines
			break
		}
		candidate := strings.TrimSpace(line)
		if candidate == "" {
			continue
		}

		// Must be between 2 and 40 characters
		if len(candidate) < 2 || len(candidate) > 40 {
			continue
		}

		// Must not be mostly digits (barcode / phone number)
		digitCount := 0
		for _, r := range candidate {
			if r >= '0' && r <= '9' {
				digitCount++
			}
		}
		if digitCount > len(candidate)/2 {
			continue
		}

		// Must not contain noise words
		candLower := strings.ToLower(candidate)
		isNoise := false
		for _, noise := range merchantNoiseWords {
			if strings.Contains(candLower, noise) {
				isNoise = true
				break
			}
		}
		if isNoise {
			continue
		}

		// Must not look like an address (contains street indicators)
		addressIndicators := []string{"jl.", "jln", "no.", "rt ", "rw ", "gg.", "blok"}
		for _, addr := range addressIndicators {
			if strings.Contains(candLower, addr) {
				isNoise = true
				break
			}
		}
		if isNoise {
			continue
		}

		// Passed all filters — this is the merchant name
		return candidate
	}
	return ""
}

// parseIDRAmount converts Indonesian/mixed-format number strings to float64.
//
// Format rules:
//   - "1.500.000"      → 1500000  (dot = thousands separator)
//   - "1.500.000,50"   → 1500000.50 (dot = thousands, comma = decimal)
//   - "646,912"        → 646912  (comma followed by exactly 3 digits = thousands separator)
//   - "646.912"        → 646912  (dot followed by exactly 3 digits = thousands separator)
//   - "1500000,50"     → 1500000.50 (comma followed by 1-2 digits = decimal)
//   - "75000"          → 75000
func parseIDRAmount(s string) float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}

	lastComma := strings.LastIndex(s, ",")
	lastDot := strings.LastIndex(s, ".")

	if lastComma != -1 {
		afterComma := s[lastComma+1:]
		// Count digits immediately after the last comma
		digitCount := 0
		for _, c := range afterComma {
			if c >= '0' && c <= '9' {
				digitCount++
			} else {
				break
			}
		}
		if digitCount == 3 {
			// Comma is a thousands separator (e.g. "646,912" or "1,500,000")
			// Remove all commas and dots-as-thousands, parse as integer
			s = strings.ReplaceAll(s, ",", "")
			s = removeDotThousands(s)
		} else {
			// Comma is a decimal separator (e.g. "1.500.000,50")
			intPart := strings.ReplaceAll(s[:lastComma], ".", "")
			intPart = strings.ReplaceAll(intPart, ",", "")
			decPart := afterComma
			s = intPart + "." + decPart
		}
	} else if lastDot != -1 {
		afterDot := s[lastDot+1:]
		digitCount := 0
		for _, c := range afterDot {
			if c >= '0' && c <= '9' {
				digitCount++
			} else {
				break
			}
		}
		if digitCount == 3 {
			// Dot is a thousands separator (e.g. "646.912" or "1.500.000")
			s = removeDotThousands(s)
		}
		// else: dot is decimal separator, parse as-is
	}

	v, _ := strconv.ParseFloat(s, 64)
	return v
}

func removeDotThousands(s string) string {
	var b strings.Builder
	runes := []rune(s)
	for i, r := range runes {
		if r == '.' {
			after := string(runes[i+1:])
			digitCount := 0
			for _, c := range after {
				if !unicode.IsDigit(c) {
					break
				}
				digitCount++
			}
			if digitCount == 3 {
				continue // thousands separator — skip
			}
		}
		b.WriteRune(r)
	}
	return b.String()
}
