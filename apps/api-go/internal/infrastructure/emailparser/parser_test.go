package emailparser

import (
	"math"
	"testing"
)

// ─── parseAmount ─────────────────────────────────────────────────────────────

func TestParseAmount(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  float64
		ok    bool
	}{
		{"Indonesian thousands dot", "1.500.000", 1_500_000, true},
		{"Indonesian decimal comma", "1.500.000,50", 1_500_000.50, true},
		{"US comma thousands multi", "1,500,000", 1_500_000, true},
		{"Single dot thousands 3-digits", "72.000", 72_000, true},
		{"Single dot decimal", "1.5", 1.5, true},
		{"Single comma 3-from-end", "72,000", 72_000, true},
		{"Single comma decimal", "1,50", 1.50, true},
		{"Rp prefix stripped", "Rp1.500.000", 1_500_000, true},
		{"Rp with space", "Rp 50.000", 50_000, true},
		{"IDR prefix", "IDR 100000", 100_000, true},
		{"Plain integer", "50000", 50_000, true},
		{"Zero", "0", 0, true},
		{"Empty string", "", 0, false},
		{"Non-numeric", "abc", 0, false},
		{"Large amount", "10.000.000", 10_000_000, true},
		{"Decimal comma only", "99,99", 99.99, true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := parseAmount(tc.input)
			if ok != tc.ok {
				t.Errorf("parseAmount(%q): ok=%v, want %v", tc.input, ok, tc.ok)
				return
			}
			if ok && math.Abs(got-tc.want) > 0.001 {
				t.Errorf("parseAmount(%q) = %v, want %v", tc.input, got, tc.want)
			}
		})
	}
}

// ─── stripHTML ───────────────────────────────────────────────────────────────

func TestStripHTML(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"<b>Hello</b>", "Hello"},
		{"<p>Rp&nbsp;50.000</p>", "Rp 50.000"},
		{"A &amp; B", "A & B"},
		{"plain text", "plain text"},
	}
	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			got := stripHTML(tc.input)
			if got != tc.want {
				t.Errorf("stripHTML(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}

// ─── Parse ───────────────────────────────────────────────────────────────────

func TestParse_BCA_Expense(t *testing.T) {
	result := Parse(
		"no_reply@klikbca.com",
		"Informasi Transaksi BCA",
		"Telah dilakukan transaksi debet. Nominal: Rp75.000. Merchant: INDOMARET. No Rek: 1234567890.",
		"",
	)
	if !result.Matched {
		t.Fatal("expected BCA match")
	}
	if result.Data.Bank != "BCA" {
		t.Errorf("Bank=%q, want BCA", result.Data.Bank)
	}
	if result.Data.Type != "expense" {
		t.Errorf("Type=%q, want expense", result.Data.Type)
	}
	if math.Abs(result.Data.Amount-75_000) > 1 {
		t.Errorf("Amount=%v, want 75000", result.Data.Amount)
	}
}

func TestParse_GoPay_Expense(t *testing.T) {
	result := Parse(
		"no-reply@gopay.co.id",
		"Notifikasi Transaksi GoPay",
		"Pembayaran sebesar Rp50.000 berhasil ke GOJEK FOOD",
		"",
	)
	if !result.Matched {
		t.Fatalf("expected GoPay match")
	}
	if result.Data.Bank != "GoPay" {
		t.Errorf("Bank=%q, want GoPay", result.Data.Bank)
	}
	if math.Abs(result.Data.Amount-50_000) > 1 {
		t.Errorf("Amount=%v, want 50000", result.Data.Amount)
	}
}

func TestParse_NoMatch(t *testing.T) {
	result := Parse("newsletter@random.com", "Weekly digest", "Nothing financial here", "")
	if result.Matched {
		t.Error("expected no match for non-bank email")
	}
}

func TestParse_HTMLFallback(t *testing.T) {
	result := Parse(
		"no_reply@klikbca.com",
		"Informasi Transaksi BCA",
		"", // no plain text
		"<p>Transaksi debet Rp<b>200.000</b> ke GRAB.</p>",
	)
	if !result.Matched {
		t.Fatal("expected BCA match via HTML fallback")
	}
	if math.Abs(result.Data.Amount-200_000) > 1 {
		t.Errorf("Amount=%v, want 200000", result.Data.Amount)
	}
}
