package payment

import (
	"bytes"
	"crypto/sha512"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type MidtransService struct {
	serverKey    string
	clientKey    string
	isProduction bool
	httpClient   *http.Client
}

type SnapRequest struct {
	TransactionDetails TransactionDetails `json:"transaction_details"`
	CustomerDetails    CustomerDetails    `json:"customer_details"`
	ItemDetails        []ItemDetail       `json:"item_details"`
}

type TransactionDetails struct {
	OrderID     string `json:"order_id"`
	GrossAmount int64  `json:"gross_amount"`
}

type CustomerDetails struct {
	FirstName string `json:"first_name"`
	Email     string `json:"email"`
}

type ItemDetail struct {
	ID       string `json:"id"`
	Price    int64  `json:"price"`
	Quantity int    `json:"quantity"`
	Name     string `json:"name"`
}

type SnapResponse struct {
	Token       string `json:"token"`
	RedirectURL string `json:"redirect_url"`
}

func NewMidtransService(serverKey, clientKey string, isProduction bool) *MidtransService {
	return &MidtransService{
		serverKey:    serverKey,
		clientKey:    clientKey,
		isProduction: isProduction,
		httpClient:   &http.Client{},
	}
}

func (m *MidtransService) Enabled() bool { return m.serverKey != "" }

func (m *MidtransService) ClientKey() string { return m.clientKey }

func (m *MidtransService) snapBaseURL() string {
	if m.isProduction {
		return "https://app.midtrans.com/snap/v1/transactions"
	}
	return "https://app.sandbox.midtrans.com/snap/v1/transactions"
}

func (m *MidtransService) CreateSnapToken(req SnapRequest) (*SnapResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequest(http.MethodPost, m.snapBaseURL(), bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	auth := base64.StdEncoding.EncodeToString([]byte(m.serverKey + ":"))
	httpReq.Header.Set("Authorization", "Basic "+auth)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := m.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("midtrans snap error %d: %s", resp.StatusCode, string(respBody))
	}
	var snapResp SnapResponse
	if err := json.Unmarshal(respBody, &snapResp); err != nil {
		return nil, err
	}
	return &snapResp, nil
}

// VerifyNotification validates SHA512(orderID+statusCode+grossAmount+serverKey).
func (m *MidtransService) VerifyNotification(orderID, statusCode, grossAmount, signatureKey string) bool {
	h := sha512.New()
	h.Write([]byte(orderID + statusCode + grossAmount + m.serverKey))
	return fmt.Sprintf("%x", h.Sum(nil)) == signatureKey
}
