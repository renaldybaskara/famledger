package entity

import (
	"time"

	"github.com/google/uuid"
)

// WorkspaceTier represents workspace subscription tier
type WorkspaceTier string

const (
	WorkspaceTierPersonal WorkspaceTier = "personal"
	WorkspaceTierFamily   WorkspaceTier = "family"
	WorkspaceTierBusiness WorkspaceTier = "business"
)

// WorkspaceRole represents member roles in a workspace
type WorkspaceRole string

const (
	WorkspaceRoleOwner       WorkspaceRole = "owner"
	WorkspaceRoleAdmin       WorkspaceRole = "admin"
	WorkspaceRoleContributor WorkspaceRole = "contributor"
	WorkspaceRoleViewer      WorkspaceRole = "viewer"
)

// WorkspaceInviteStatus represents the status of an invitation
type WorkspaceInviteStatus string

const (
	WorkspaceInvitePending  WorkspaceInviteStatus = "pending"
	WorkspaceInviteAccepted WorkspaceInviteStatus = "accepted"
	WorkspaceInviteDeclined WorkspaceInviteStatus = "declined"
	WorkspaceInviteExpired  WorkspaceInviteStatus = "expired"
)

// Workspace represents a shared financial workspace (personal/family/business)
type Workspace struct {
	ID          uuid.UUID     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name        string        `gorm:"not null;size:255" json:"name"`
	Description *string       `gorm:"size:1000" json:"description,omitempty"`
	Tier        WorkspaceTier `gorm:"default:personal;not null;size:20" json:"tier"`
	OwnerID     uuid.UUID     `gorm:"type:uuid;not null;index" json:"ownerId"`
	AvatarURL   *string       `gorm:"column:avatar_url" json:"avatarUrl,omitempty"`
	Currency    string        `gorm:"default:IDR;not null;size:10" json:"currency"`
	IsActive    bool          `gorm:"default:true;not null" json:"isActive"`
	DeletedAt   *time.Time    `json:"-"`
	CreatedAt   time.Time     `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time     `gorm:"autoUpdateTime" json:"updatedAt"`

	// Relations
	Owner   *User               `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Members []WorkspaceMember   `gorm:"foreignKey:WorkspaceID" json:"members,omitempty"`
	Invites []WorkspaceInvite   `gorm:"foreignKey:WorkspaceID" json:"invites,omitempty"`
}

func (Workspace) TableName() string {
	return "workspaces"
}

// WorkspaceMember represents a user's membership in a workspace
type WorkspaceMember struct {
	ID          uuid.UUID     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WorkspaceID uuid.UUID     `gorm:"type:uuid;not null;index" json:"workspaceId"`
	UserID      uuid.UUID     `gorm:"type:uuid;not null;index" json:"userId"`
	Role        WorkspaceRole `gorm:"not null;size:20" json:"role"`
	JoinedAt    time.Time     `gorm:"autoCreateTime" json:"joinedAt"`
	UpdatedAt   time.Time     `gorm:"autoUpdateTime" json:"updatedAt"`

	// Relations
	Workspace *Workspace `gorm:"foreignKey:WorkspaceID" json:"workspace,omitempty"`
	User      *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (WorkspaceMember) TableName() string {
	return "workspace_members"
}

// WorkspaceInvite represents a pending invitation to join a workspace
type WorkspaceInvite struct {
	ID          uuid.UUID             `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WorkspaceID uuid.UUID             `gorm:"type:uuid;not null;index" json:"workspaceId"`
	InvitedBy   uuid.UUID             `gorm:"type:uuid;not null" json:"invitedBy"`
	Email       string                `gorm:"not null;size:255;index" json:"email"`
	Role        WorkspaceRole         `gorm:"not null;size:20" json:"role"`
	Token       string                `gorm:"not null;size:255;uniqueIndex" json:"-"`
	Status      WorkspaceInviteStatus `gorm:"default:pending;not null;size:20" json:"status"`
	ExpiresAt   time.Time             `json:"expiresAt"`
	AcceptedAt  *time.Time            `json:"acceptedAt,omitempty"`
	CreatedAt   time.Time             `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time             `gorm:"autoUpdateTime" json:"updatedAt"`

	// Relations
	Workspace *Workspace `gorm:"foreignKey:WorkspaceID" json:"workspace,omitempty"`
	Inviter   *User      `gorm:"foreignKey:InvitedBy" json:"inviter,omitempty"`
}

func (WorkspaceInvite) TableName() string {
	return "workspace_invites"
}

// WorkspaceActivityLog represents an audit log entry for workspace actions
type WorkspaceActivityLog struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	WorkspaceID uuid.UUID  `gorm:"type:uuid;not null;index" json:"workspaceId"`
	UserID      uuid.UUID  `gorm:"type:uuid;not null;index" json:"userId"`
	Action      string     `gorm:"not null;size:100" json:"action"`
	EntityType  string     `gorm:"size:50" json:"entityType,omitempty"`
	EntityID    *uuid.UUID `gorm:"type:uuid" json:"entityId,omitempty"`
	Metadata    *string    `gorm:"type:text" json:"metadata,omitempty"`
	CreatedAt   time.Time  `gorm:"autoCreateTime" json:"createdAt"`

	// Relations
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (WorkspaceActivityLog) TableName() string {
	return "workspace_activity_logs"
}
