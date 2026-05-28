package repository

import (
	"context"
	"errors"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type workspaceRepository struct {
	db *gorm.DB
}

func NewWorkspaceRepository(db *gorm.DB) domainrepo.WorkspaceRepository {
	return &workspaceRepository{db: db}
}

// --- Workspace CRUD ---

func (r *workspaceRepository) Create(ctx context.Context, ws *entity.Workspace) error {
	return r.db.WithContext(ctx).Create(ws).Error
}

func (r *workspaceRepository) FindByID(ctx context.Context, id uuid.UUID) (*entity.Workspace, error) {
	var ws entity.Workspace
	err := r.db.WithContext(ctx).
		Preload("Owner").
		Where("id = ? AND deleted_at IS NULL", id).
		First(&ws).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &ws, nil
}

func (r *workspaceRepository) FindByOwnerID(ctx context.Context, ownerID uuid.UUID) ([]entity.Workspace, error) {
	var workspaces []entity.Workspace
	err := r.db.WithContext(ctx).
		Where("owner_id = ? AND deleted_at IS NULL", ownerID).
		Order("created_at DESC").
		Find(&workspaces).Error
	return workspaces, err
}

func (r *workspaceRepository) FindByMemberID(ctx context.Context, userID uuid.UUID) ([]entity.Workspace, error) {
	var workspaces []entity.Workspace
	err := r.db.WithContext(ctx).
		Joins("JOIN workspace_members wm ON wm.workspace_id = workspaces.id").
		Where("wm.user_id = ? AND workspaces.deleted_at IS NULL", userID).
		Preload("Owner").
		Order("workspaces.created_at DESC").
		Find(&workspaces).Error
	return workspaces, err
}

func (r *workspaceRepository) Update(ctx context.Context, id uuid.UUID, data map[string]interface{}) (*entity.Workspace, error) {
	err := r.db.WithContext(ctx).Model(&entity.Workspace{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Updates(data).Error
	if err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id)
}

func (r *workspaceRepository) Delete(ctx context.Context, id uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).Model(&entity.Workspace{}).
		Where("id = ?", id).
		Update("deleted_at", now).Error
}

// --- Membership ---

func (r *workspaceRepository) AddMember(ctx context.Context, member *entity.WorkspaceMember) error {
	return r.db.WithContext(ctx).Create(member).Error
}

func (r *workspaceRepository) FindMember(ctx context.Context, workspaceID, userID uuid.UUID) (*entity.WorkspaceMember, error) {
	var member entity.WorkspaceMember
	err := r.db.WithContext(ctx).
		Preload("User").
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		First(&member).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &member, nil
}

func (r *workspaceRepository) ListMembers(ctx context.Context, workspaceID uuid.UUID) ([]entity.WorkspaceMember, error) {
	var members []entity.WorkspaceMember
	err := r.db.WithContext(ctx).
		Preload("User").
		Where("workspace_id = ?", workspaceID).
		Order("joined_at ASC").
		Find(&members).Error
	return members, err
}

func (r *workspaceRepository) UpdateMemberRole(ctx context.Context, workspaceID, userID uuid.UUID, role entity.WorkspaceRole) error {
	return r.db.WithContext(ctx).Model(&entity.WorkspaceMember{}).
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		Update("role", role).Error
}

func (r *workspaceRepository) RemoveMember(ctx context.Context, workspaceID, userID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("workspace_id = ? AND user_id = ?", workspaceID, userID).
		Delete(&entity.WorkspaceMember{}).Error
}

// --- Invites ---

func (r *workspaceRepository) CreateInvite(ctx context.Context, invite *entity.WorkspaceInvite) error {
	return r.db.WithContext(ctx).Create(invite).Error
}

func (r *workspaceRepository) FindInviteByToken(ctx context.Context, token string) (*entity.WorkspaceInvite, error) {
	var invite entity.WorkspaceInvite
	err := r.db.WithContext(ctx).
		Preload("Workspace").
		Preload("Inviter").
		Where("token = ?", token).
		First(&invite).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &invite, nil
}

func (r *workspaceRepository) FindInviteByEmail(ctx context.Context, workspaceID uuid.UUID, email string) (*entity.WorkspaceInvite, error) {
	var invite entity.WorkspaceInvite
	err := r.db.WithContext(ctx).
		Where("workspace_id = ? AND email = ? AND status = 'pending'", workspaceID, email).
		First(&invite).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &invite, nil
}

func (r *workspaceRepository) FindPendingInvitesByEmail(ctx context.Context, email string) ([]entity.WorkspaceInvite, error) {
	var invites []entity.WorkspaceInvite
	err := r.db.WithContext(ctx).
		Where("email = ? AND status = 'pending' AND expires_at > NOW()", email).
		Order("created_at ASC").
		Find(&invites).Error
	return invites, err
}

func (r *workspaceRepository) ListInvites(ctx context.Context, workspaceID uuid.UUID) ([]entity.WorkspaceInvite, error) {
	var invites []entity.WorkspaceInvite
	err := r.db.WithContext(ctx).
		Preload("Inviter").
		Where("workspace_id = ?", workspaceID).
		Order("created_at DESC").
		Find(&invites).Error
	return invites, err
}

func (r *workspaceRepository) UpdateInviteStatus(ctx context.Context, id uuid.UUID, status entity.WorkspaceInviteStatus, acceptedAt interface{}) error {
	updates := map[string]interface{}{"status": status}
	if acceptedAt != nil {
		updates["accepted_at"] = acceptedAt
	}
	return r.db.WithContext(ctx).Model(&entity.WorkspaceInvite{}).
		Where("id = ?", id).
		Updates(updates).Error
}

// --- Activity log ---

func (r *workspaceRepository) LogActivity(ctx context.Context, log *entity.WorkspaceActivityLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *workspaceRepository) ListActivity(ctx context.Context, workspaceID uuid.UUID, limit int) ([]entity.WorkspaceActivityLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var logs []entity.WorkspaceActivityLog
	err := r.db.WithContext(ctx).
		Preload("User").
		Where("workspace_id = ?", workspaceID).
		Order("created_at DESC").
		Limit(limit).
		Find(&logs).Error
	return logs, err
}
