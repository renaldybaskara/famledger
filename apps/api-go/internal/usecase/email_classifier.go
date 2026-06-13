package usecase

import (
	"regexp"
	"strings"
)

// ClassifyResult is the output of classifyEmail.
type ClassifyResult struct {
	IsFinancial bool // true = email contains financial transaction signals
	SkipAI      bool // true = email is clearly non-financial (promo, reply, etc.)
}

// Package-level compiled patterns — initialised once at startup.
var (
	skipSubjectPrefixRe = regexp.MustCompile(
		`(?i)^(re:|fwd:|fw:|balasan:|jawaban:|reply:|forward:)\s`)

	rpAmountRe = regexp.MustCompile(`(?i)\brp\.?\s*[\d]{3}[\d.,]*`)

	skipKeywords = []string{
		"unsubscribe", "berhenti berlangganan", "opt-out",
		"newsletter", "buletin",
		"promo ", "promosi", "penawaran spesial", "flash sale", "harbolnas",
		"survei", "survey", "feedback", "ulasan anda", "berikan ulasan",
		"kode verifikasi", "kode otp", "one-time password",
		"verifikasi email", "konfirmasi email", "aktifkan akun",
		"selamat datang di", "welcome to",
		"kebijakan privasi", "syarat dan ketentuan",
		"tiket dukungan", "nomor tiket #", "ticket id:",
		"do not reply", "no-reply",
		"informasi layanan", "pembaruan layanan", "kebijakan baru",
	}

	// strongFinancialKeywords — a single match is sufficient to classify as financial.
	strongFinancialKeywords = []string{
		"pembelian", "pembayaran", "transaksi",
		"debit", "kredit", "terdebit", "terkreditkan",
		"transfer", "penarikan", "tarik tunai",
		"setoran", "setor tunai",
		"tagihan", "cicilan", "angsuran",
		"top up", "topup",
		"saldo berkurang", "saldo bertambah",
		"notifikasi transaksi", "konfirmasi transaksi",
		"pembayaran berhasil", "transaksi berhasil", "transaksi sukses",
		"diterima", "terkirim",
	}
)

// classifyEmail returns whether the email should be sent to AI and whether it
// contains financial signals. Skip triggers are evaluated first — if any match,
// the email is never sent to AI regardless of financial content.
func classifyEmail(subject, body string) ClassifyResult {
	subjectLower := strings.ToLower(subject)

	// Limit body scan to first 400 chars for speed.
	scanBody := body
	if len(scanBody) > 400 {
		scanBody = scanBody[:400]
	}
	combined := subjectLower + " " + strings.ToLower(scanBody)

	// ── Step 1: Skip triggers (evaluated first — short-circuit) ─────────────
	if skipSubjectPrefixRe.MatchString(subjectLower) {
		return ClassifyResult{IsFinancial: false, SkipAI: true}
	}
	for _, kw := range skipKeywords {
		if strings.Contains(combined, kw) {
			return ClassifyResult{IsFinancial: false, SkipAI: true}
		}
	}

	// ── Step 2: Financial signals ────────────────────────────────────────────
	for _, kw := range strongFinancialKeywords {
		if strings.Contains(combined, kw) {
			return ClassifyResult{IsFinancial: true, SkipAI: false}
		}
	}

	// Rp + amount pattern alone is a strong financial signal.
	if rpAmountRe.MatchString(combined) {
		return ClassifyResult{IsFinancial: true, SkipAI: false}
	}

	return ClassifyResult{IsFinancial: false, SkipAI: false}
}
