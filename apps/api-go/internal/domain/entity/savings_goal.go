package entity

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SavingsGoal represents a savings target with multi-source tracking
type SavingsGoal struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID        uuid.UUID      `gorm:"type:uuid;not null;index" json:"userId"`
	WorkspaceID   *uuid.UUID     `gorm:"type:uuid;index" json:"workspaceId,omitempty"`
	Name          string         `gorm:"not null;size:255" json:"name"`
	Description   *string        `gorm:"type:text" json:"description,omitempty"`
	TargetAmount  float64        `gorm:"type:numeric(15,2);not null" json:"targetAmount"`
	CurrentAmount float64        `gorm:"type:numeric(15,2);default:0;not null" json:"currentAmount"`
	Currency      string         `gorm:"default:IDR;not null;size:3" json:"currency"`
	Icon          string         `gorm:"default:🎯;size:50" json:"icon"`
	Color         string         `gorm:"default:#6B8E6B;size:7" json:"color"`
	Deadline      *time.Time     `json:"deadline,omitempty"`
	Status        string         `gorm:"default:active;not null;size:20" json:"status"` // active|achieved|paused|cancelled
	AchievedAt    *time.Time     `json:"achievedAt,omitempty"`
	CreatedAt     time.Time      `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time      `gorm:"autoUpdateTime" json:"updatedAt"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	Sources       []SavingsGoalSource       `gorm:"foreignKey:GoalID" json:"sources,omitempty"`
	Contributions []SavingsGoalContribution `gorm:"foreignKey:GoalID" json:"contributions,omitempty"`
	User          *User                     `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (SavingsGoal) TableName() string {
	return "savings_goals"
}

// SavingsGoalSource represents a savings source (bank, stocks, gold, etc.)
type SavingsGoalSource struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	GoalID        uuid.UUID  `gorm:"type:uuid;not null;index" json:"goalId"`
	SourceType    string     `gorm:"not null;size:20" json:"sourceType"` // saving_account|stocks|gold|crypto|reksadana|deposit|cash|other
	SourceName    string     `gorm:"not null;size:255" json:"sourceName"`
	TrackingMode  string     `gorm:"default:manual;not null;size:20" json:"trackingMode"` // auto|manual
	AccountID     *uuid.UUID `gorm:"type:uuid" json:"accountId,omitempty"`
	CurrentAmount float64    `gorm:"type:numeric(15,2);default:0;not null" json:"currentAmount"`
	CreatedAt     time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`

	// Relations
	Goal    *SavingsGoal `gorm:"foreignKey:GoalID" json:"-"`
	Account *Account     `gorm:"foreignKey:AccountID" json:"account,omitempty"`
}

func (SavingsGoalSource) TableName() string {
	return "savings_goal_sources"
}

// SavingsGoalContribution represents a single contribution (auto or manual)
type SavingsGoalContribution struct {
	ID            uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	GoalID        uuid.UUID  `gorm:"type:uuid;not null;index" json:"goalId"`
	SourceID      uuid.UUID  `gorm:"type:uuid;not null;index" json:"sourceId"`
	UserID        uuid.UUID  `gorm:"type:uuid;not null;index" json:"userId"`
	TransactionID *uuid.UUID `gorm:"type:uuid;uniqueIndex" json:"transactionId,omitempty"`
	Amount        float64    `gorm:"type:numeric(15,2);not null" json:"amount"` // positive = add, negative = withdraw
	Type          string     `gorm:"not null;size:20" json:"type"`              // manual|auto|withdraw
	Note          *string    `gorm:"type:text" json:"note,omitempty"`
	ContributedAt time.Time  `gorm:"not null" json:"contributedAt"`
	CreatedAt     time.Time  `gorm:"autoCreateTime" json:"createdAt"`

	// Relations
	Goal   *SavingsGoal       `gorm:"foreignKey:GoalID" json:"-"`
	Source *SavingsGoalSource `gorm:"foreignKey:SourceID" json:"source,omitempty"`
	User   *User              `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (SavingsGoalContribution) TableName() string {
	return "savings_goal_contributions"
}

// SavingsGoalAllocation for multi-goal per account splitting
type SavingsGoalAllocation struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	AccountID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_account_goal" json:"accountId"`
	GoalID    uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_account_goal" json:"goalId"`
	SourceID  uuid.UUID `gorm:"type:uuid;not null" json:"sourceId"`
	Percentage float64  `gorm:"type:numeric(5,2);not null" json:"percentage"` // 0-100
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updatedAt"`

	// Relations
	Account *Account          `gorm:"foreignKey:AccountID" json:"account,omitempty"`
	Goal    *SavingsGoal      `gorm:"foreignKey:GoalID" json:"-"`
	Source  *SavingsGoalSource `gorm:"foreignKey:SourceID" json:"-"`
}

func (SavingsGoalAllocation) TableName() string {
	return "savings_goal_allocations"
}
