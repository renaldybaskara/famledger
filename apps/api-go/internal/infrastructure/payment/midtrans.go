// Package payment provides a Midtrans Snap client for web-based subscription payments.
package payment

import (
	"bytes"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	snapSandboxURL      = "https://app.sandbox.midtrans.com/snap/v1/transactions"
	snapProductionURL   = "https://app.midtrans.com/snap/v1/transactions"
	statusSandboxURL    = "https://api.sandbox.midtrans.com/v2"
	statusProductionURL = "https://api.midtrans.com/v2"
)

// MidtransService creates Snap payment tokens and verifies webhook notifications.
type MidtransService struct {
	serverKey    string
	clientKey    string
	merchantID   string
	isProduction bool
	client       *http.Client
}

// NewMidtransService returns a ready-to-use MidtransService.
// If serverKey is empty the service is disabled — Enabled() returns false.
func NewMidtransService(serverKey, clientKey, merchantID string, isProduction bool) *MidtransService {
	return &MidtransService{
		serverKey:    serverKey,
		clientKey:    clientKey,
		merchantID:   merchantID,
		isProduction: isProduction,
		client:       &http.Client{Timeout: 15 * time.Second},
	}
}

// Enabled returns whether Midtrans is configured.
func (s *MidtransService) Enabled() bool { return s.serverKey != "" }

// ClientKey returns the client key for use in the frontend Snap.js script tag.
func (s *MidtransService) ClientKey() string { return s.clientKey }

// IsProduction returns whether the service is using the production environment.
func (s *MidtransService) IsProduction() bool { return s.isProduction }

func (s *MidtransService) snapURL() string {
	if s.isProduction {
		return snapProductionURL
	}
	return snapSandboxURL
}

// SnapTokenResponse is returned by CreateSnapToken.
type SnapTokenResponse struct {
	Token       string `json:"token"`
	RedirectURL string `json:"redirect_url"`
}

// CreateSnapToken calls the Midtrans Snap API and returns a payment token
// that the frontend uses to open the Snap payment popup.
func (s *MidtransService) CreateSnapToken(orderID string, grossAmount int64, plan, period, email, name string) (*SnapTokenResponse, error) {
	if !s.Enabled() {
		return nil, fmt.Errorf("midtrans not configured")
	}

	body, _ := json.Marshal(map[string]interface{}{
		"transaction_details": map[string]interface{}{
			"order_id":     orderID,
			"gross_amount": grossAmount,
		},
		"customer_details": map[string]interface{}{
			"first_name": name,
			"email":      email,
		},
		"item_details": []map[string]interface{}{
			{
				"id":       plan + "-" + period,
				"price":    grossAmount,
				"quantity": 1,
				"name":     "FamLedger Pro — " + periodLabel(period),
			},
		},
		"credit_card": map[string]interface{}{
			"secure": true,
		},
	})

	req, err := http.NewRequest(http.MethodPost, s.snapURL(), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("midtrans request: %w", err)
	}
	req.SetBasicAuth(s.serverKey, "")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("midtrans call: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("midtrans status %d: %s", resp.StatusCode, string(respBody))
	}

	var result SnapTokenResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("midtrans decode: %w", err)
	}
	return &result, nil
}

// TransactionStatusResponse is the relevant subset of Midtrans /v2/{id}/status response.
type TransactionStatusResponse struct {
	TransactionStatus string `json:"transaction_status"`
	FraudStatus       string `json:"fraud_status"`
	StatusCode        string `json:"status_code"`
	GrossAmount       string `json:"gross_amount"`
	SignatureKey      string `json:"signature_key"`
}

func (s *MidtransService) statusBaseURL() string {
	if s.isProduction {
		return statusProductionURL
	}
	return statusSandboxURL
}

// GetTransactionStatus fetches the current status of an order directly from Midtrans.
// This is used by the confirm-payment endpoint so the frontend does not have to wait for a webhook.
func (s *MidtransService) GetTransactionStatus(orderID string) (*TransactionStatusResponse, error) {
	url := fmt.Sprintf("%s/%s/status", s.statusBaseURL(), orderID)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("midtrans status request: %w", err)
	}
	req.SetBasicAuth(s.serverKey, "")
	req.Header.Set("Accept", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("midtrans status call: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("midtrans status %d: %s", resp.StatusCode, string(body))
	}

	var result TransactionStatusResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("midtrans status decode: %w", err)
	}
	return &result, nil
}

// VerifySignatureKey validates the signature_key field sent by Midtrans in notifications.
func (s *MidtransService) VerifySignatureKey(orderID, statusCode, grossAmount, signatureKey string) bool {
	raw := orderID + statusCode + grossAmount + s.serverKey
	expected := fmt.Sprintf("%x", sha512.Sum512([]byte(raw)))
	return subtle.ConstantTimeCompare([]byte(expected), []byte(signatureKey)) == 1
}

// PlanAmount returns the gross amount in IDR for a given plan period.
func PlanAmount(period string) int64 {
	switch period {
	case "annual":
		return 249000
	case "lifetime":
		return 499000
	default: // monthly
		return 29000
	}
}

func periodLabel(period string) string {
	switch period {
	case "annual":
		return "Tahunan"
	case "lifetime":
		return "Seumur Hidup"
	default:
		return "Bulanan"
	}
}
