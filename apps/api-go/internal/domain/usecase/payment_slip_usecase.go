package usecase

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

// ParsedSlip holds structured financial data extracted from a payment slip image.
type ParsedSlip struct {
	Amount        float64    `json:"amount"`        // 0 if undetected
	Merchant      string     `json:"merchant"`      // "" if undetected
	Date          *time.Time `json:"date"`          // nil if undetected
	Bank          string     `json:"bank"`          // "BCA", "BRI", etc.
	Type          string     `json:"type"`          // "expense"|"income"|""
	AccountNumber string     `json:"accountNumber"` // "" if undetected
	RawText       string     `json:"rawText"`       // raw OCR output
	Confidence    float64    `json:"confidence"`    // OCR confidence score 0–1
}

// ScanSlipInput is the input to PaymentSlipUseCase.ScanSlip.
type ScanSlipInput struct {
	ImageBytes []byte
	Filename   string
	UserID     uuid.UUID
}

// PaymentSlipUseCase is the port consumed by the HTTP handler.
type PaymentSlipUseCase interface {
	ScanSlip(ctx context.Context, in ScanSlipInput) (*ParsedSlip, error)
}

var (
	ErrOCRServiceUnavailable = errors.New("OCR service unavailable")
	ErrImageTooLarge         = errors.New("image too large (max 10 MB)")
)
