package ocr

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

// ExtractResult is the response from the OCR microservice.
type ExtractResult struct {
	Text       string  `json:"text"`
	Confidence float64 `json:"confidence"`
}

// Client calls the PaddleOCR Python microservice.
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// NewClient creates a new OCR client. baseURL should be e.g. "http://ocr:5000".
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 60 * time.Second, // OCR inference can take 5–30s on CPU
		},
	}
}

// Extract sends imageBytes to the OCR service and returns the extracted text.
func (c *Client) Extract(ctx context.Context, imageBytes []byte, filename string) (*ExtractResult, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, fmt.Errorf("ocr: create form file: %w", err)
	}
	if _, err := io.Copy(part, bytes.NewReader(imageBytes)); err != nil {
		return nil, fmt.Errorf("ocr: copy image bytes: %w", err)
	}
	writer.Close()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/ocr/extract", &body)
	if err != nil {
		return nil, fmt.Errorf("ocr: build request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ocr: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ocr: service returned %d: %s", resp.StatusCode, string(b))
	}

	var result ExtractResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("ocr: decode response: %w", err)
	}
	return &result, nil
}
