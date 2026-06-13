package emailparser

import (
	"regexp"
	"strings"

	"github.com/fintrackr/api/internal/domain/entity"
)

// DBBankParser implements bankParser from a BankParserRule stored in the database.
// It is built dynamically at runtime when the email worker starts or rules change.
type DBBankParser struct {
	rule entity.BankParserRule

	// compiled patterns (built once from the rule fields)
	fromPatterns    []string
	subjectPatterns []string
	expenseKws      []string
	incomeKws       []string
	bodyConfirmKws  []string
	amountRe        *regexp.Regexp
}

// NewDBBankParser compiles a BankParserRule into a ready-to-use bankParser.
func NewDBBankParser(rule entity.BankParserRule) *DBBankParser {
	p := &DBBankParser{
		rule:            rule,
		fromPatterns:    splitTrim(rule.FromPatterns),
		subjectPatterns: splitTrim(rule.SubjectPatterns),
		expenseKws:      splitTrim(rule.ExpenseKeywords),
		incomeKws:       splitTrim(rule.IncomeKeywords),
		bodyConfirmKws:  splitTrim(rule.BodyConfirmKeywords),
	}

	// Compile custom amount regex or fall back to the standard Indonesian Rp pattern.
	if rule.AmountRegex != "" {
		if re, err := regexp.Compile(rule.AmountRegex); err == nil {
			p.amountRe = re
		}
	}
	if p.amountRe == nil {
		p.amountRe = regexp.MustCompile(`(?i)Rp\.?\s*(?P<amount>[\d.,]+)`)
	}

	return p
}

// Matches returns true if the email looks like it came from this bank.
func (p *DBBankParser) Matches(from, subject, combined string) bool {
	// Check from patterns
	for _, pat := range p.fromPatterns {
		if pat != "" && strings.Contains(from, strings.ToLower(pat)) {
			return p.confirmBody(combined)
		}
	}
	// Check subject patterns
	for _, pat := range p.subjectPatterns {
		if pat != "" && strings.Contains(subject, strings.ToLower(pat)) {
			return p.confirmBody(combined)
		}
	}
	return false
}

// confirmBody checks optional body confirmation keywords.
// If bodyConfirmKws is empty, always returns true (no extra check needed).
func (p *DBBankParser) confirmBody(combined string) bool {
	if len(p.bodyConfirmKws) == 0 {
		return true
	}
	lower := strings.ToLower(combined)
	for _, kw := range p.bodyConfirmKws {
		if kw != "" && strings.Contains(lower, strings.ToLower(kw)) {
			return true
		}
	}
	return false
}

// Parse extracts transaction details from the matched email.
func (p *DBBankParser) Parse(from, subject, combined string) ParseResult {
	// Rule has no extraction config → delegate to AI for full extraction.
	if p.rule.ExpenseKeywords == "" && p.rule.IncomeKeywords == "" && p.rule.AmountRegex == "" {
		return ParseResult{Matched: true, IsAIOnly: true, MatchedRuleID: p.rule.ID}
	}

	lower := strings.ToLower(combined)

	// Determine transaction type.
	txType := p.rule.DefaultType
	if txType == "" {
		txType = "expense"
	}

	isExpense := false
	isIncome := false
	for _, kw := range p.expenseKws {
		if kw != "" && strings.Contains(lower, strings.ToLower(kw)) {
			isExpense = true
			break
		}
	}
	for _, kw := range p.incomeKws {
		if kw != "" && strings.Contains(lower, strings.ToLower(kw)) {
			isIncome = true
			break
		}
	}
	// Income wins only if no expense keyword found
	if isIncome && !isExpense {
		txType = "income"
	} else if isExpense {
		txType = "expense"
	}

	// Extract amount.
	amountStr := extractFirst(p.amountRe, combined)
	amount, ok := parseAmount(amountStr)
	if !ok || amount <= 0 {
		return ParseResult{Matched: false}
	}

	return ParseResult{Matched: true, Data: &ParsedTransaction{
		Bank:        p.rule.Name,
		Type:        txType,
		Amount:      amount,
		Description: p.rule.Name + ": " + subject,
		RawFields:   map[string]string{"subject": subject, "from": from, "rule_id": uitoa(p.rule.ID)},
	}}
}

// ── ParseWithDBRules merges DB rules + hardcoded parsers ──────────────────────

// ParseWithRules is the DB-aware version of Parse.
// It evaluates dbRules FIRST (lower priority number = checked first),
// then falls through to the built-in hardcoded parsers.
func ParseWithRules(from, subject, bodyText, bodyHTML string, dbRules []entity.BankParserRule) ParseResult {
	// Normalise
	subject = strings.TrimSpace(subject)
	body := bodyText
	if body == "" {
		body = stripHTML(bodyHTML)
	}
	combined := subject + "\n" + body
	fromLower := strings.ToLower(from)
	subjectLower := strings.ToLower(subject)
	combinedLower := strings.ToLower(combined)

	// 1. Try DB-backed rules first (admin-managed, higher priority)
	for _, rule := range dbRules {
		if !rule.IsActive {
			continue
		}
		p := NewDBBankParser(rule)
		if p.Matches(fromLower, subjectLower, combinedLower) {
			result := p.Parse(from, subject, combined)
			if result.Matched || result.IsAIOnly {
				return result
			}
		}
	}

	// 2. Fall through to hardcoded parsers
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

// ── helpers ───────────────────────────────────────────────────────────────────

// splitTrim splits a comma-separated string, trims whitespace, removes empty entries.
func splitTrim(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func uitoa(n uint) string {
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 10)
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	return string(buf)
}
