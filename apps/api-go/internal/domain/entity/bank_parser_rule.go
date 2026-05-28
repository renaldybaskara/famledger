package entity

import "time"

// BankParserRule is a user-manageable rule that tells the email parser
// how to recognise and extract transactions from a specific bank/ewallet.
//
// Rules stored here are merged with the hardcoded parsers at runtime:
//   - DB rules are evaluated FIRST (before hardcoded ones)
//   - This lets admins override or add support for any bank from the UI
//
// IsActive = false → rule is disabled (not deleted, so history is preserved)
// IsGlobal = true  → applies to ALL users' inboxes
//                    (only admin-created rules should be global)
type BankParserRule struct {
	ID   uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Name string `gorm:"not null;size:100;uniqueIndex" json:"name"` // display name e.g. "BCA", "GoPay"

	// ── Matching patterns (OR logic: any match → rule fires) ──
	// Comma-separated substrings / regex fragments checked against the sender address (lowercased).
	// Example: "@klikbca.com,@bca.co.id,mybca"
	FromPatterns string `gorm:"type:text;not null" json:"fromPatterns"`

	// Comma-separated substrings checked against the email subject (lowercased).
	// Example: "informasi transaksi,notifikasi,debet,kredit,bca"
	SubjectPatterns string `gorm:"type:text;not null" json:"subjectPatterns"`

	// ── Extraction keywords ──
	// Comma-separated words that indicate an EXPENSE (debit) transaction.
	// Example: "debet,debit,pembayaran,pembelian,transfer ke,belanja"
	ExpenseKeywords string `gorm:"type:text" json:"expenseKeywords"`

	// Comma-separated words that indicate an INCOME (credit) transaction.
	// Example: "kredit,masuk,diterima,top up,top-up"
	IncomeKeywords string `gorm:"type:text" json:"incomeKeywords"`

	// ── Optional: body keyword to confirm this is a financial email ──
	// If set, the body must contain at least one of these words for the rule to fire.
	// Leave empty to rely solely on from/subject patterns.
	// Example: "bank central asia,klikbca"
	BodyConfirmKeywords string `gorm:"type:text" json:"bodyConfirmKeywords"`

	// ── Regex for amount extraction ──
	// Named-group regex with group "amount". Leave empty to use the default
	// Indonesian Rp pattern: (?i)Rp\.?\s*(?P<amount>[\d.,]+)
	// Example (custom): (?i)Total\s*:\s*(?P<amount>[\d.,]+)
	AmountRegex string `gorm:"type:text" json:"amountRegex"`

	// Default transaction type when neither expense nor income keywords match.
	// "expense" or "income" — defaults to "expense" if empty.
	DefaultType string `gorm:"size:10;default:expense" json:"defaultType"`

	// Priority — lower number = checked first. DB rules default to 0 (before hardcoded).
	Priority int `gorm:"default:0;not null" json:"priority"`

	IsActive bool      `gorm:"default:true;not null" json:"isActive"`
	IsGlobal bool      `gorm:"default:true;not null" json:"isGlobal"` // always true for now
	Note     string    `gorm:"type:text" json:"note"`                  // admin memo
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (BankParserRule) TableName() string { return "bank_parser_rules" }
