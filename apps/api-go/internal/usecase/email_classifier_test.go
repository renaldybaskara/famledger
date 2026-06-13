package usecase

import "testing"

func TestClassifyEmail(t *testing.T) {
	tests := []struct {
		name        string
		subject     string
		body        string
		isFinancial bool
		skipAI      bool
	}{
		// ── Skip triggers ────────────────────────────────────────────
		{
			name:        "reply prefix skips",
			subject:     "Re: Konfirmasi pembayaran",
			body:        "pembayaran Rp50.000",
			isFinancial: false,
			skipAI:      true,
		},
		{
			name:        "fwd prefix skips",
			subject:     "Fwd: Transfer BCA",
			body:        "transfer Rp100.000",
			isFinancial: false,
			skipAI:      true,
		},
		{
			name:        "unsubscribe in body skips",
			subject:     "Info promo bulanan",
			body:        "Klik di sini untuk unsubscribe dari newsletter kami.",
			isFinancial: false,
			skipAI:      true,
		},
		{
			name:        "OTP email skips",
			subject:     "Kode Verifikasi Anda",
			body:        "Kode OTP Anda adalah 123456. Jangan bagikan.",
			isFinancial: false,
			skipAI:      true,
		},
		{
			name:        "do not reply skips",
			subject:     "Pembaruan Layanan",
			body:        "do not reply to this email. informasi layanan terbaru.",
			isFinancial: false,
			skipAI:      true,
		},
		// ── Financial signals ────────────────────────────────────────
		{
			name:        "debit keyword is financial",
			subject:     "Notifikasi Transaksi",
			body:        "Telah terjadi transaksi debit pada rekening Anda.",
			isFinancial: true,
			skipAI:      false,
		},
		{
			name:        "transfer keyword is financial",
			subject:     "Konfirmasi Transfer",
			body:        "Transfer sebesar Rp200.000 berhasil dikirim.",
			isFinancial: true,
			skipAI:      false,
		},
		{
			name:        "Rp amount regex is financial",
			subject:     "Struk Pembelian",
			body:        "Total: Rp150.000",
			isFinancial: true,
			skipAI:      false,
		},
		{
			name:        "top up is financial",
			subject:     "Top Up GoPay",
			body:        "top up saldo GoPay berhasil.",
			isFinancial: true,
			skipAI:      false,
		},
		// ── No signal ────────────────────────────────────────────────
		{
			name:        "generic email",
			subject:     "Selamat ulang tahun",
			body:        "Semoga hari mu menyenangkan.",
			isFinancial: false,
			skipAI:      false,
		},
		{
			name:        "empty email",
			subject:     "",
			body:        "",
			isFinancial: false,
			skipAI:      false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := classifyEmail(tc.subject, tc.body)
			if got.IsFinancial != tc.isFinancial {
				t.Errorf("IsFinancial=%v, want %v", got.IsFinancial, tc.isFinancial)
			}
			if got.SkipAI != tc.skipAI {
				t.Errorf("SkipAI=%v, want %v", got.SkipAI, tc.skipAI)
			}
		})
	}
}

func TestClassifyEmail_SkipWinsOverFinancial(t *testing.T) {
	got := classifyEmail(
		"Re: Notifikasi transaksi debit",
		"pembayaran Rp50.000 transfer sukses unsubscribe",
	)
	if !got.SkipAI {
		t.Error("expected SkipAI=true: reply prefix should win over financial keywords")
	}
	if got.IsFinancial {
		t.Error("expected IsFinancial=false when skip triggered")
	}
}

func TestClassifyEmail_BodyTruncatedAt400(t *testing.T) {
	// "unsubscribe" placed past the 400-char scan window should NOT trigger skip.
	padding := make([]byte, 400)
	for i := range padding { padding[i] = 'x' }
	body := string(padding) + "unsubscribe"
	got := classifyEmail("Normal subject", body)
	if got.SkipAI {
		t.Error("expected SkipAI=false: 'unsubscribe' is beyond 400-char scan window")
	}
}
