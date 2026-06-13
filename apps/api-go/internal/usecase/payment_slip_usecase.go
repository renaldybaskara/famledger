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
	reAmount = regexp.MustCompile(`(?i)(?:Rp\.?|IDR)\s*([\d.,]+)`)

	// Indonesian full date: "15 Januari 2026"
	reDate1 = regexp.MustCompile(`(?i)\b(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})\b`)
	// DD/MM/YYYY or DD-MM-YYYY
	reDate2 = regexp.MustCompile(`\b(\d{2})[/\-](\d{2})[/\-](\d{4})\b`)
	// ISO YYYY-MM-DD
	reDate3 = regexp.MustCompile(`\b(\d{4})-(\d{2})-(\d{2})\b`)

	reMerchant = regexp.MustCompile(`(?i)(?:nama\s+merchant|merchant\s*:?|toko\s*:?|nama\s+toko\s*:?|kepada\s*:?|to\s*:?|beneficiary\s*:?)\s*([^\n\r]{2,50})`)

	reAccNum = regexp.MustCompile(`\b(\d{8,16})\b`)

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
		"tarik tunai", "pembelian", "belanja",
	}
	incomeKeywords = []string{
		"kredit", "credit", "transfer masuk", "uang masuk", "setoran",
		"diterima", "top up", "topup",
	}
)

func parseSlipText(text string, confidence float64) *domainuc.ParsedSlip {
	lower := strings.ToLower(text)
	slip := &domainuc.ParsedSlip{
		RawText:    text,
		Confidence: confidence,
	}

	// Amount — take the largest Rp value (transaction amount is usually the biggest)
	matches := reAmount.FindAllStringSubmatch(text, -1)
	var maxAmount float64
	for _, m := range matches {
		if v := parseIDRAmount(m[1]); v > maxAmount {
			maxAmount = v
		}
	}
	slip.Amount = maxAmount

	// Date — Indonesian full date → DD/MM/YYYY → ISO
	if m := reDate1.FindStringSubmatch(lower); m != nil {
		day, _ := strconv.Atoi(m[1])
		month := indonesianMonths[m[2]]
		year, _ := strconv.Atoi(m[3])
		t := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
		slip.Date = &t
	} else if m := reDate2.FindStringSubmatch(text); m != nil {
		day, _ := strconv.Atoi(m[1])
		month, _ := strconv.Atoi(m[2])
		year, _ := strconv.Atoi(m[3])
		if month >= 1 && month <= 12 && day >= 1 && day <= 31 {
			t := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
			slip.Date = &t
		}
	} else if m := reDate3.FindStringSubmatch(text); m != nil {
		year, _ := strconv.Atoi(m[1])
		month, _ := strconv.Atoi(m[2])
		day, _ := strconv.Atoi(m[3])
		t := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
		slip.Date = &t
	}

	// Merchant — look for label-prefixed lines
	if m := reMerchant.FindStringSubmatch(text); m != nil {
		slip.Merchant = strings.TrimSpace(m[1])
	}

	// Bank — first keyword match wins (ordered most→least specific)
	for _, b := range bankKeywords {
		if strings.Contains(lower, b.keyword) {
			slip.Bank = b.name
			break
		}
	}

	// Transaction type — expense keywords checked first; default to "expense"
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

	// Account number — first 8–16 digit sequence that isn't the transaction amount
	amountStr := strconv.FormatInt(int64(maxAmount), 10)
	for _, m := range reAccNum.FindAllStringSubmatch(text, -1) {
		candidate := m[1]
		if candidate != amountStr && !strings.Contains(amountStr, candidate) {
			slip.AccountNumber = candidate
			break
		}
	}

	return slip
}

// parseIDRAmount converts Indonesian-formatted number strings to float64.
// Handles "1.500.000", "1.500.000,50", "75000".
func parseIDRAmount(s string) float64 {
	s = strings.TrimSpace(s)
	if idx := strings.LastIndex(s, ","); idx != -1 {
		intPart := strings.ReplaceAll(s[:idx], ".", "")
		decPart := s[idx+1:]
		s = intPart + "." + decPart
	} else {
		s = removeDotThousands(s)
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
