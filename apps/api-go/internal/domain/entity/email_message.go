package entity

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// EmailMessage represents a scanned email from an integration inbox.
// ParseStatus tracks the pipeline: received → parsed → imported (or failed/skipped).
type EmailMessage struct {
	ID                  uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	EmailIntegrationID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"emailIntegrationId"`
	UserID              uuid.UUID      `gorm:"type:uuid;not null;index" json:"userId"`

	// Raw email data
	MessageID           string         `gorm:"size:500;uniqueIndex" json:"messageId"` // IMAP UID or Gmail message ID
	Subject             string         `gorm:"size:1000" json:"subject"`
	From                string         `gorm:"size:500" json:"from"`
	ReceivedAt          time.Time      `json:"receivedAt"`
	BodyText            *string        `gorm:"type:text" json:"-"`     // raw body for re-parsing
	BodyHTML            *string        `gorm:"type:text" json:"-"`

	// Parse result
	ParseStatus         string         `gorm:"default:pending;not null;size:20" json:"parseStatus"` // pending|imported|skipped|failed
	ParsedBank          *string        `gorm:"size:50" json:"parsedBank,omitempty"`
	ParsedType          *string        `gorm:"size:20" json:"parsedType,omitempty"` // income|expense|transfer
	ParsedAmount        *float64       `gorm:"type:numeric(15,2)" json:"parsedAmount,omitempty"`
	ParsedMerchant      *string        `gorm:"size:500" json:"parsedMerchant,omitempty"`
	ParsedDescription   *string        `gorm:"size:1000" json:"parsedDescription,omitempty"`
	ParsedAccountNumber *string        `gorm:"size:50" json:"parsedAccountNumber,omitempty"`
	ParsedDate          *time.Time     `json:"parsedDate,omitempty"`
	ParsedRawData       datatypes.JSON `gorm:"type:jsonb" json:"parsedRawData,omitempty"`
	ParseError          *string        `gorm:"size:500" json:"parseError,omitempty"`

	// Import result
	TransactionID       *uuid.UUID     `gorm:"type:uuid" json:"transactionId,omitempty"` // set when imported
	ImportedAt          *time.Time     `json:"importedAt,omitempty"`
	SkipReason          *string        `gorm:"size:255" json:"skipReason,omitempty"`

	CreatedAt           time.Time      `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt           time.Time      `gorm:"autoUpdateTime" json:"updatedAt"`

	// Relations
	Transaction *Transaction `gorm:"foreignKey:TransactionID" json:"transaction,omitempty"`
}

func (EmailMessage) TableName() string {
	return "email_messages"
}
