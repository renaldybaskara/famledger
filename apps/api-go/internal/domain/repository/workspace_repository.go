package repository

import (
	"context"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type WorkspaceRepository interface {
	// Workspace CRUD
	Create(ctx context.Context, ws *entity.Workspace) error
	FindByID(ctx context.Context, id uuid.UUID) (*entity.Workspace, error)
	FindByOwnerID(ctx context.Context, ownerID uuid.UUID) ([]entity.Workspace, error)
	FindByMemberID(ctx context.Context, userID uuid.UUID) ([]entity.Workspace, error)
	Update(ctx context.Context, id uuid.UUID, data map[string]interface{}) (*entity.Workspace, error)
	Delete(ctx context.Context, id uuid.UUID) error

	// Membership
	AddMember(ctx context.Context, member *entity.WorkspaceMember) error
	FindMember(ctx context.Context, workspaceID, userID uuid.UUID) (*entity.WorkspaceMember, error)
	ListMembers(ctx context.Context, workspaceID uuid.UUID) ([]entity.WorkspaceMember, error)
	UpdateMemberRole(ctx context.Context, workspaceID, userID uuid.UUID, role entity.WorkspaceRole) error
	RemoveMember(ctx context.Context, workspaceID, userID uuid.UUID) error

	// Invites
	CreateInvite(ctx context.Context, invite *entity.WorkspaceInvite) error
	FindInviteByToken(ctx context.Context, token string) (*entity.WorkspaceInvite, error)
	FindInviteByEmail(ctx context.Context, workspaceID uuid.UUID, email string) (*entity.WorkspaceInvite, error)
	// FindPendingInvitesByEmail returns all pending, non-expired invites for an email address.
	// Used during registration to auto-join workspaces the new user was invited to.
	FindPendingInvitesByEmail(ctx context.Context, email string) ([]entity.WorkspaceInvite, error)
	ListInvites(ctx context.Context, workspaceID uuid.UUID) ([]entity.WorkspaceInvite, error)
	UpdateInviteStatus(ctx context.Context, id uuid.UUID, status entity.WorkspaceInviteStatus, acceptedAt interface{}) error

	// Activity log
	LogActivity(ctx context.Context, log *entity.WorkspaceActivityLog) error
	ListActivity(ctx context.Context, workspaceID uuid.UUID, limit int) ([]entity.WorkspaceActivityLog, error)
}
