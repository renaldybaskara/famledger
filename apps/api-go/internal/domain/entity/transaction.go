package entity

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Transaction struct {
	ID                 uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID             uuid.UUID      `gorm:"type:uuid;not null;index:tx_user_date_idx,composite:ud" json:"userId"`
	AccountID          *uuid.UUID     `gorm:"type:uuid;index" json:"accountId,omitempty"`
	CategoryID         *uuid.UUID     `gorm:"type:uuid;index" json:"categoryId,omitempty"`
	Type               string         `gorm:"not null;size:20" json:"type"` // income|expense|transfer
	Amount             float64        `gorm:"type:numeric(15,2);not null" json:"amount"`
	Currency           string         `gorm:"default:IDR;not null;size:3" json:"currency"`
	Description        *string        `json:"description,omitempty"`
	Merchant           *string        `gorm:"size:255" json:"merchant,omitempty"`
	Note               *string        `json:"note,omitempty"`
	Source             string         `gorm:"default:manual;not null;size:20" json:"source"`
	Status             string         `gorm:"default:confirmed;not null;size:20" json:"status"`
	Date               time.Time      `gorm:"not null;index:tx_user_date_idx,composite:ud" json:"date"`
	CategoryConfidence *float64       `gorm:"type:numeric(3,2)" json:"categoryConfidence,omitempty"`
	IsManuallyEdited   bool           `gorm:"default:false" json:"isManuallyEdited"`
	IsRecurring        bool           `gorm:"default:false" json:"isRecurring"`
	RecurringGroupID   *uuid.UUID     `gorm:"type:uuid" json:"recurringGroupId,omitempty"`
	RawData            datatypes.JSON `gorm:"type:jsonb" json:"rawData,omitempty"`
	ExternalID         *string        `gorm:"size:255" json:"externalId,omitempty"`
	IdempotencyKey     *string        `gorm:"uniqueIndex;size:255" json:"-"`
	TransferPairID     *uuid.UUID     `gorm:"type:uuid" json:"transferPairId,omitempty"`
	DeletedAt          *time.Time     `json:"-"`
	CreatedAt          time.Time      `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time      `gorm:"autoUpdateTime" json:"updatedAt"`

	// Associations (preloaded)
	Category *Category `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Account  *Account  `gorm:"foreignKey:AccountID" json:"account,omitempty"`
}

func (Transaction) TableName() string {
	return "transactions"
}

type TransactionAuditLog struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	TransactionID uuid.UUID      `gorm:"type:uuid;not null;index" json:"transactionId"`
	UserID        uuid.UUID      `gorm:"type:uuid;not null;index" json:"userId"`
	Action        string         `gorm:"not null;size:50" json:"action"`
	Before        datatypes.JSON `gorm:"type:jsonb" json:"before,omitempty"`
	After         datatypes.JSON `gorm:"type:jsonb" json:"after,omitempty"`
	CreatedAt     time.Time      `gorm:"autoCreateTime" json:"createdAt"`
}

func (TransactionAuditLog) TableName() string {
	return "transaction_audit_logs"
}
