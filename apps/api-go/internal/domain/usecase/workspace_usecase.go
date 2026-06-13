package usecase

import (
	"context"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/google/uuid"
)

// WorkspaceTxRow is a transaction enriched with the member's name and ID,
// used when returning workspace-level transaction lists.
type WorkspaceTxRow struct {
	entity.Transaction
	MemberName string    `json:"memberName"`
	MemberID   uuid.UUID `json:"memberId"`
}

type CreateWorkspaceInput struct {
	Name        string
	Description *string
	Tier        entity.WorkspaceTier
	Currency    string
}

type UpdateWorkspaceInput struct {
	Name        *string
	Description *string
	Currency    *string
}

type InviteMemberInput struct {
	Email string
	Role  entity.WorkspaceRole
}

type WorkspaceUseCase interface {
	// Workspace CRUD
	Create(ctx context.Context, ownerID uuid.UUID, in CreateWorkspaceInput) (*entity.Workspace, error)
	GetByID(ctx context.Context, workspaceID, userID uuid.UUID) (*entity.Workspace, error)
	ListForUser(ctx context.Context, userID uuid.UUID) ([]entity.Workspace, error)
	Update(ctx context.Context, workspaceID, userID uuid.UUID, in UpdateWorkspaceInput) (*entity.Workspace, error)
	Delete(ctx context.Context, workspaceID, userID uuid.UUID) error

	// Member management
	ListMembers(ctx context.Context, workspaceID, requestingUserID uuid.UUID) ([]entity.WorkspaceMember, error)
	UpdateMemberRole(ctx context.Context, workspaceID, targetUserID, requestingUserID uuid.UUID, role entity.WorkspaceRole) error
	RemoveMember(ctx context.Context, workspaceID, targetUserID, requestingUserID uuid.UUID) error
	LeaveWorkspace(ctx context.Context, workspaceID, userID uuid.UUID) error

	// Invitations
	InviteMember(ctx context.Context, workspaceID, inviterID uuid.UUID, in InviteMemberInput) (*entity.WorkspaceInvite, error)
	AcceptInvite(ctx context.Context, token string, userID uuid.UUID) (*entity.WorkspaceMember, error)
	DeclineInvite(ctx context.Context, token string, userID uuid.UUID) error
	ListInvites(ctx context.Context, workspaceID, requestingUserID uuid.UUID) ([]entity.WorkspaceInvite, error)
	RevokeInvite(ctx context.Context, inviteID, workspaceID, requestingUserID uuid.UUID) error
	GetMyPendingInvites(ctx context.Context, userEmail string) ([]entity.WorkspaceInvite, error)

	// Activity
	ListActivity(ctx context.Context, workspaceID, userID uuid.UUID, limit int) ([]entity.WorkspaceActivityLog, error)

	// Shared finance data — aggregates across all workspace members (two-query, no JOIN).
	GetMemberUserIDsForScope(ctx context.Context, workspaceID, requestingUserID uuid.UUID) ([]uuid.UUID, error)
	GetWorkspaceTransactions(ctx context.Context, workspaceID, requestingUserID uuid.UUID, q domainrepo.ListTransactionsQuery) ([]WorkspaceTxRow, int64, error)
	GetWorkspaceSummary(ctx context.Context, workspaceID, requestingUserID uuid.UUID, start, end time.Time) (*domainrepo.TransactionSummary, error)
	GetWorkspaceCategoryBreakdown(ctx context.Context, workspaceID, requestingUserID uuid.UUID, txType string, start, end time.Time) ([]domainrepo.CategoryBreakdownRow, error)
}
