// Package ai provides an OpenRouter client for AI-assisted email parsing.
// Used as a fallback when regex-based parsing cannot determine merchant or category.
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"strconv"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const openRouterBaseURL = "https://openrouter.ai/api/v1/chat/completions"

// ParseResult is what we ask the AI to return for an ambiguous email.
type ParseResult struct {
	Merchant string `json:"merchant"` // clean merchant name, empty if unknown
	Category string `json:"category"` // category fragment: makanan/transport/belanja/tagihan/kesehatan/dll
	Type     string `json:"type"`     // "expense" | "income" | "transfer" | ""
}

// OpenRouterService calls the OpenRouter API for AI-assisted parsing.
type OpenRouterService struct {
	apiKey  string
	model   string
	client  *http.Client
	enabled bool
}

// New creates a ready-to-use OpenRouterService.
// If apiKey is empty, the service is disabled — all calls return empty results gracefully.
func New(apiKey, model string) *OpenRouterService {
	if model == "" {
		// Default: Gemini 2.0 Flash (free tier on OpenRouter, no credit needed)
		model = "google/gemini-2.0-flash-exp:free"
	}
	return &OpenRouterService{
		apiKey:  apiKey,
		model:   model,
		client:  &http.Client{Timeout: 10 * time.Second},
		enabled: apiKey != "",
	}
}

// Enabled returns whether the AI service is configured.
func (s *OpenRouterService) Enabled() bool {
	return s.enabled
}

// ParseEmailContent asks the AI to extract merchant and category from an email body.
// Returns empty ParseResult if AI is disabled or the call fails.
func (s *OpenRouterService) ParseEmailContent(ctx context.Context, subject, bodyText string) (ParseResult, error) {
	if !s.enabled {
		return ParseResult{}, nil
	}

	// Truncate body to keep prompt small and cost low
	if len(bodyText) > 800 {
		bodyText = bodyText[:800]
	}

	prompt := fmt.Sprintf(`Kamu adalah parser email transaksi bank Indonesia.
Analisa email berikut dan ekstrak informasi transaksi.

Subject: %s
Body: %s

Jawab dengan JSON berikut (jangan tambahkan teks lain):
{
  "merchant": "nama merchant/toko/penerima yang bersih, kosong jika tidak ada",
  "category": "salah satu dari: makanan, kopi, transport, belanja, tagihan, kesehatan, pendidikan, langganan, rumah, hiburan, atau kosong jika tidak yakin",
  "type": "expense jika pengeluaran, income jika pemasukan, kosong jika tidak jelas"
}`, subject, bodyText)

	reqBody, _ := json.Marshal(map[string]interface{}{
		"model": s.model,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"max_tokens":  150,
		"temperature": 0,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openRouterBaseURL, bytes.NewReader(reqBody))
	if err != nil {
		return ParseResult{}, fmt.Errorf("openrouter request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://github.com/fintrackr")
	req.Header.Set("X-Title", "FamLedger")

	resp, err := s.client.Do(req)
	if err != nil {
		return ParseResult{}, fmt.Errorf("openrouter call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return ParseResult{}, fmt.Errorf("openrouter status %d: %s", resp.StatusCode, string(b))
	}

	var apiResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return ParseResult{}, fmt.Errorf("openrouter decode: %w", err)
	}
	if len(apiResp.Choices) == 0 {
		return ParseResult{}, nil
	}

	content := strings.TrimSpace(apiResp.Choices[0].Message.Content)
	// Strip markdown code fences if present
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var result ParseResult
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return ParseResult{}, fmt.Errorf("openrouter parse response: %w", err)
	}

	return result, nil
}

// FullParseResult is returned by ParseEmailFull for unmatched emails.
// Amount is a raw string so the caller validates before converting to float.
type FullParseResult struct {
	Type     string `json:"type"`     // "expense"|"income"|"transfer"|""
	Amount   string `json:"amount"`   // digits only, e.g. "50000"
	Merchant string `json:"merchant"`
	Category string `json:"category"`
}

// ParseEmailFull extracts a complete transaction from an email not recognised by
// any bank parser. Unlike ParseEmailContent (merchant enrichment only), this prompt
// asks for type + amount + merchant + category in one call.
func (s *OpenRouterService) ParseEmailFull(ctx context.Context, subject, bodyText string) (FullParseResult, error) {
	if !s.enabled {
		return FullParseResult{}, nil
	}

	if len(bodyText) > 800 {
		bodyText = bodyText[:800]
	}

	prompt := fmt.Sprintf(`Kamu adalah parser email transaksi keuangan Indonesia.
Analisa email berikut dan ekstrak data transaksi lengkap.

Subject: %s
Body: %s

Jawab dengan JSON berikut SAJA (tanpa teks lain):
{
  "type": "expense jika pengeluaran/debit, income jika pemasukan/kredit, transfer jika transfer antar rekening, atau kosong jika bukan transaksi",
  "amount": "jumlah uang dalam ANGKA SAJA tanpa titik ribuan atau koma, contoh: 50000 atau 1500000",
  "merchant": "nama merchant/toko/penerima yang bersih, kosong jika tidak ada",
  "category": "salah satu dari: makanan, kopi, transport, belanja, tagihan, kesehatan, pendidikan, langganan, rumah, hiburan, atau kosong"
}`, subject, bodyText)

	reqBody, _ := json.Marshal(map[string]interface{}{
		"model": s.model,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"max_tokens":  250,
		"temperature": 0,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openRouterBaseURL, bytes.NewReader(reqBody))
	if err != nil {
		return FullParseResult{}, fmt.Errorf("openrouter request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://github.com/fintrackr")
	req.Header.Set("X-Title", "FamLedger")

	resp, err := s.client.Do(req)
	if err != nil {
		return FullParseResult{}, fmt.Errorf("openrouter call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return FullParseResult{}, fmt.Errorf("openrouter status %d: %s", resp.StatusCode, string(b))
	}

	var apiResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return FullParseResult{}, fmt.Errorf("openrouter decode: %w", err)
	}
	if len(apiResp.Choices) == 0 {
		return FullParseResult{}, nil
	}

	content := strings.TrimSpace(apiResp.Choices[0].Message.Content)
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var result FullParseResult
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return FullParseResult{}, fmt.Errorf("openrouter full parse: %w", err)
	}

	return result, nil
}

// CategorizeTransaction asks the AI for a single category word given a transaction's
// merchant, description, and type. Used as a final NLP fallback in matchCategory
// when all keyword-based steps fail. Very cheap: max_tokens 20.
func (s *OpenRouterService) CategorizeTransaction(ctx context.Context, merchant, description, txType string) (string, error) {
	if !s.enabled {
		return "", nil
	}

	target := strings.TrimSpace(merchant + " " + description)
	if target == "" {
		return "", nil
	}

	expenseList := "makanan, kopi, transport, belanja, tagihan, kesehatan, pendidikan, langganan, rumah, hiburan, pakaian, olahraga"
	incomeList := "gaji, freelance, investasi, bonus"
	transferList := "transfer, tabungan"

	prompt := fmt.Sprintf(`Kamu adalah sistem kategorisasi transaksi keuangan Indonesia.
Berikan SATU kata kategori untuk transaksi berikut:

Merchant/Deskripsi: %s
Tipe: %s

Pilihan kategori:
- expense: %s
- income: %s
- transfer: %s

Jawab dengan SATU kata saja tanpa penjelasan apapun.`,
		target, txType, expenseList, incomeList, transferList)

	reqBody, _ := json.Marshal(map[string]interface{}{
		"model": s.model,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"max_tokens":  20,
		"temperature": 0,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openRouterBaseURL, bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("openrouter request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "https://github.com/fintrackr")
	req.Header.Set("X-Title", "FamLedger")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("openrouter call: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("openrouter status %d: %s", resp.StatusCode, string(b))
	}

	var apiResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return "", fmt.Errorf("openrouter decode: %w", err)
	}
	if len(apiResp.Choices) == 0 {
		return "", nil
	}

	words := strings.Fields(strings.TrimSpace(apiResp.Choices[0].Message.Content))
	if len(words) == 0 {
		return "", nil
	}
	result := strings.ToLower(strings.Trim(words[0], `.,;:"'`))
	return result, nil
}

// ValidateFullParseResult checks that AI-extracted data is usable.
// Returns parsed amount and ok=true only when type is recognised and amount > 0.
func ValidateFullParseResult(r FullParseResult) (amount float64, ok bool) {
	validTypes := map[string]bool{"expense": true, "income": true, "transfer": true}
	if !validTypes[strings.ToLower(strings.TrimSpace(r.Type))] {
		return 0, false
	}

	raw := strings.TrimSpace(r.Amount)
	raw = strings.ReplaceAll(raw, " ", "")

	// Handle Indonesian thousands separator (dots) vs decimal comma.
	if strings.Contains(raw, ".") && strings.Contains(raw, ",") {
		raw = strings.ReplaceAll(raw, ".", "")
		raw = strings.ReplaceAll(raw, ",", ".")
	} else if strings.Contains(raw, ".") {
		parts := strings.Split(raw, ".")
		// Dot followed by exactly 3 digits = thousands separator, not decimal.
		if len(parts) == 2 && len(parts[1]) == 3 {
			raw = strings.ReplaceAll(raw, ".", "")
		}
	} else {
		raw = strings.ReplaceAll(raw, ",", ".")
	}

	v, err := strconv.ParseFloat(raw, 64)
	if err != nil || v <= 0 {
		return 0, false
	}
	return v, true
}
