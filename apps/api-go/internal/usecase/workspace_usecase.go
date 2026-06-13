package usecase

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	emailsvc "github.com/fintrackr/api/internal/infrastructure/email"
	"github.com/google/uuid"
)

var (
	ErrWorkspaceNotFound      = errors.New("workspace not found")
	ErrNotWorkspaceMember     = errors.New("you are not a member of this workspace")
	ErrInsufficientPermission = errors.New("insufficient permission")
	ErrAlreadyMember          = errors.New("user is already a member")
	ErrInviteAlreadySent      = errors.New("invite already sent to this email")
	ErrInviteNotFound         = errors.New("invite not found or expired")
	ErrCannotRemoveOwner      = errors.New("cannot remove workspace owner")
)

type workspaceUseCase struct {
	repo     domainrepo.WorkspaceRepository
	userRepo domainrepo.UserRepository
	txRepo   domainrepo.TransactionRepository
	emailSvc emailsvc.EmailService
}

func NewWorkspaceUseCase(repo domainrepo.WorkspaceRepository, userRepo domainrepo.UserRepository, txRepo domainrepo.TransactionRepository, emailSvc emailsvc.EmailService) domainuc.WorkspaceUseCase {
	return &workspaceUseCase{repo: repo, userRepo: userRepo, txRepo: txRepo, emailSvc: emailSvc}
}

func (uc *workspaceUseCase) Create(ctx context.Context, ownerID uuid.UUID, in domainuc.CreateWorkspaceInput) (*entity.Workspace, error) {
	tier := in.Tier
	if tier == "" {
		tier = entity.WorkspaceTierPersonal
	}
	currency := in.Currency
	if currency == "" {
		currency = "IDR"
	}

	ws := &entity.Workspace{
		ID:          uuid.New(),
		Name:        in.Name,
		Description: in.Description,
		Tier:        tier,
		OwnerID:     ownerID,
		Currency:    currency,
		IsActive:    true,
	}

	if err := uc.repo.Create(ctx, ws); err != nil {
		return nil, err
	}

	// Auto-add owner as member
	member := &entity.WorkspaceMember{
		ID:          uuid.New(),
		WorkspaceID: ws.ID,
		UserID:      ownerID,
		Role:        entity.WorkspaceRoleOwner,
	}
	if err := uc.repo.AddMember(ctx, member); err != nil {
		return nil, err
	}

	uc.logActivity(ctx, ws.ID, ownerID, "workspace.created", "workspace", &ws.ID, nil)

	return ws, nil
}

func (uc *workspaceUseCase) GetByID(ctx context.Context, workspaceID, userID uuid.UUID) (*entity.Workspace, error) {
	ws, err := uc.repo.FindByID(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	if ws == nil {
		return nil, ErrWorkspaceNotFound
	}

	// Check membership
	member, err := uc.repo.FindMember(ctx, workspaceID, userID)
	if err != nil {
		return nil, err
	}
	if member == nil {
		return nil, ErrNotWorkspaceMember
	}

	return ws, nil
}

func (uc *workspaceUseCase) ListForUser(ctx context.Context, userID uuid.UUID) ([]entity.Workspace, error) {
	return uc.repo.FindByMemberID(ctx, userID)
}

func (uc *workspaceUseCase) Update(ctx context.Context, workspaceID, userID uuid.UUID, in domainuc.UpdateWorkspaceInput) (*entity.Workspace, error) {
	if err := uc.requireRole(ctx, workspaceID, userID, entity.WorkspaceRoleAdmin); err != nil {
		return nil, err
	}

	updates := map[string]interface{}{}
	if in.Name != nil {
		updates["name"] = *in.Name
	}
	if in.Description != nil {
		updates["description"] = *in.Description
	}
	if in.Currency != nil {
		updates["currency"] = *in.Currency
	}

	ws, err := uc.repo.Update(ctx, workspaceID, updates)
	if err != nil {
		return nil, err
	}

	uc.logActivity(ctx, workspaceID, userID, "workspace.updated", "workspace", &workspaceID, nil)

	return ws, nil
}

func (uc *workspaceUseCase) Delete(ctx context.Context, workspaceID, userID uuid.UUID) error {
	if err := uc.requireRole(ctx, workspaceID, userID, entity.WorkspaceRoleOwner); err != nil {
		return err
	}

	uc.logActivity(ctx, workspaceID, userID, "workspace.deleted", "workspace", &workspaceID, nil)

	return uc.repo.Delete(ctx, workspaceID)
}

func (uc *workspaceUseCase) ListMembers(ctx context.Context, workspaceID, requestingUserID uuid.UUID) ([]entity.WorkspaceMember, error) {
	if _, err := uc.requireMembership(ctx, workspaceID, requestingUserID); err != nil {
		return nil, err
	}
	return uc.repo.ListMembers(ctx, workspaceID)
}

func (uc *workspaceUseCase) UpdateMemberRole(ctx context.Context, workspaceID, targetUserID, requestingUserID uuid.UUID, role entity.WorkspaceRole) error {
	if err := uc.requireRole(ctx, workspaceID, requestingUserID, entity.WorkspaceRoleAdmin); err != nil {
		return err
	}
	if role == entity.WorkspaceRoleOwner {
		return ErrInsufficientPermission
	}

	// Check target is a member
	target, err := uc.repo.FindMember(ctx, workspaceID, targetUserID)
	if err != nil {
		return err
	}
	if target == nil {
		return ErrNotWorkspaceMember
	}
	if target.Role == entity.WorkspaceRoleOwner {
		return ErrCannotRemoveOwner
	}

	uc.logActivity(ctx, workspaceID, requestingUserID, "member.role_changed", "workspace_member", &targetUserID, nil)

	return uc.repo.UpdateMemberRole(ctx, workspaceID, targetUserID, role)
}

func (uc *workspaceUseCase) RemoveMember(ctx context.Context, workspaceID, targetUserID, requestingUserID uuid.UUID) error {
	if err := uc.requireRole(ctx, workspaceID, requestingUserID, entity.WorkspaceRoleAdmin); err != nil {
		return err
	}

	target, err := uc.repo.FindMember(ctx, workspaceID, targetUserID)
	if err != nil {
		return err
	}
	if target == nil {
		return ErrNotWorkspaceMember
	}
	if target.Role == entity.WorkspaceRoleOwner {
		return ErrCannotRemoveOwner
	}

	uc.logActivity(ctx, workspaceID, requestingUserID, "member.removed", "workspace_member", &targetUserID, nil)

	return uc.repo.RemoveMember(ctx, workspaceID, targetUserID)
}

func (uc *workspaceUseCase) LeaveWorkspace(ctx context.Context, workspaceID, userID uuid.UUID) error {
	member, err := uc.repo.FindMember(ctx, workspaceID, userID)
	if err != nil {
		return err
	}
	if member == nil {
		return ErrNotWorkspaceMember
	}
	if member.Role == entity.WorkspaceRoleOwner {
		return errors.New("workspace owner cannot leave — transfer ownership or delete the workspace first")
	}

	uc.logActivity(ctx, workspaceID, userID, "member.left", "workspace_member", &userID, nil)

	return uc.repo.RemoveMember(ctx, workspaceID, userID)
}

func (uc *workspaceUseCase) InviteMember(ctx context.Context, workspaceID, inviterID uuid.UUID, in domainuc.InviteMemberInput) (*entity.WorkspaceInvite, error) {
	if err := uc.requireRole(ctx, workspaceID, inviterID, entity.WorkspaceRoleAdmin); err != nil {
		return nil, err
	}

	ws, err := uc.repo.FindByID(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	// Check if already a member
	existingUser, _ := uc.userRepo.FindByEmail(ctx, in.Email)
	if existingUser != nil {
		existing, err := uc.repo.FindMember(ctx, workspaceID, existingUser.ID)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return nil, ErrAlreadyMember
		}
	}

	// Check for existing pending invite (may be expired but never cleaned up).
	// If found: invalidate the old token and fall through to create a fresh invite.
	// Accepted invites are unreachable here — the member check above already caught them.
	existingInvite, err := uc.repo.FindInviteByEmail(ctx, workspaceID, in.Email)
	if err != nil {
		return nil, err
	}
	if existingInvite != nil {
		_ = uc.repo.UpdateInviteStatus(ctx, existingInvite.ID, entity.WorkspaceInviteExpired, nil)
	}

	token, err := generateSecureToken(32)
	if err != nil {
		return nil, err
	}

	inviter, _ := uc.userRepo.FindByID(ctx, inviterID)
	inviterName := "Someone"
	if inviter != nil {
		inviterName = inviter.Name
	}

	invite := &entity.WorkspaceInvite{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		InvitedBy:   inviterID,
		Email:       in.Email,
		Role:        in.Role,
		Token:       token,
		Status:      entity.WorkspaceInvitePending,
		ExpiresAt:   time.Now().Add(7 * 24 * time.Hour),
	}

	if err := uc.repo.CreateInvite(ctx, invite); err != nil {
		return nil, err
	}

	go func() {
		if err := uc.emailSvc.SendWorkspaceInviteEmail(in.Email, inviterName, ws.Name, token); err != nil {
			log.Printf("[Workspace] invite email failed to %s: %v", in.Email, err)
		}
	}()

	uc.logActivity(ctx, workspaceID, inviterID, "invite.sent", "workspace_invite", &invite.ID, nil)

	return invite, nil
}

func (uc *workspaceUseCase) AcceptInvite(ctx context.Context, token string, userID uuid.UUID) (*entity.WorkspaceMember, error) {
	invite, err := uc.repo.FindInviteByToken(ctx, token)
	if err != nil {
		return nil, err
	}
	if invite == nil || invite.Status != entity.WorkspaceInvitePending {
		return nil, ErrInviteNotFound
	}
	if invite.ExpiresAt.Before(time.Now()) {
		_ = uc.repo.UpdateInviteStatus(ctx, invite.ID, entity.WorkspaceInviteExpired, nil)
		return nil, ErrInviteNotFound
	}

	// Check if already a member
	existing, err := uc.repo.FindMember(ctx, invite.WorkspaceID, userID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrAlreadyMember
	}

	now := time.Now()
	if err := uc.repo.UpdateInviteStatus(ctx, invite.ID, entity.WorkspaceInviteAccepted, now); err != nil {
		return nil, err
	}

	member := &entity.WorkspaceMember{
		ID:          uuid.New(),
		WorkspaceID: invite.WorkspaceID,
		UserID:      userID,
		Role:        invite.Role,
	}
	if err := uc.repo.AddMember(ctx, member); err != nil {
		return nil, err
	}

	uc.logActivity(ctx, invite.WorkspaceID, userID, "invite.accepted", "workspace_invite", &invite.ID, nil)

	return member, nil
}

func (uc *workspaceUseCase) DeclineInvite(ctx context.Context, token string, userID uuid.UUID) error {
	invite, err := uc.repo.FindInviteByToken(ctx, token)
	if err != nil {
		return err
	}
	if invite == nil || invite.Status != entity.WorkspaceInvitePending {
		return ErrInviteNotFound
	}

	uc.logActivity(ctx, invite.WorkspaceID, userID, "invite.declined", "workspace_invite", &invite.ID, nil)

	return uc.repo.UpdateInviteStatus(ctx, invite.ID, entity.WorkspaceInviteDeclined, nil)
}

func (uc *workspaceUseCase) ListInvites(ctx context.Context, workspaceID, requestingUserID uuid.UUID) ([]entity.WorkspaceInvite, error) {
	if err := uc.requireRole(ctx, workspaceID, requestingUserID, entity.WorkspaceRoleAdmin); err != nil {
		return nil, err
	}
	return uc.repo.ListInvites(ctx, workspaceID)
}

func (uc *workspaceUseCase) RevokeInvite(ctx context.Context, inviteID, workspaceID, requestingUserID uuid.UUID) error {
	if err := uc.requireRole(ctx, workspaceID, requestingUserID, entity.WorkspaceRoleAdmin); err != nil {
		return err
	}
	uc.logActivity(ctx, workspaceID, requestingUserID, "invite.revoked", "workspace_invite", &inviteID, nil)
	return uc.repo.UpdateInviteStatus(ctx, inviteID, entity.WorkspaceInviteDeclined, nil)
}

func (uc *workspaceUseCase) ListActivity(ctx context.Context, workspaceID, userID uuid.UUID, limit int) ([]entity.WorkspaceActivityLog, error) {
	if _, err := uc.requireMembership(ctx, workspaceID, userID); err != nil {
		return nil, err
	}
	return uc.repo.ListActivity(ctx, workspaceID, limit)
}

func (uc *workspaceUseCase) GetMyPendingInvites(ctx context.Context, userEmail string) ([]entity.WorkspaceInvite, error) {
	return uc.repo.FindPendingInvitesByEmail(ctx, userEmail)
}

// --- helpers ---

func (uc *workspaceUseCase) requireMembership(ctx context.Context, workspaceID, userID uuid.UUID) (*entity.WorkspaceMember, error) {
	member, err := uc.repo.FindMember(ctx, workspaceID, userID)
	if err != nil {
		return nil, err
	}
	if member == nil {
		return nil, ErrNotWorkspaceMember
	}
	return member, nil
}

func (uc *workspaceUseCase) requireRole(ctx context.Context, workspaceID, userID uuid.UUID, minRole entity.WorkspaceRole) error {
	member, err := uc.requireMembership(ctx, workspaceID, userID)
	if err != nil {
		return err
	}

	// Role hierarchy: owner > admin > contributor > viewer
	hierarchy := map[entity.WorkspaceRole]int{
		entity.WorkspaceRoleViewer:      1,
		entity.WorkspaceRoleContributor: 2,
		entity.WorkspaceRoleAdmin:       3,
		entity.WorkspaceRoleOwner:       4,
	}

	if hierarchy[member.Role] < hierarchy[minRole] {
		return ErrInsufficientPermission
	}
	return nil
}

func (uc *workspaceUseCase) logActivity(ctx context.Context, workspaceID, userID uuid.UUID, action, entityType string, entityID *uuid.UUID, metadata *string) {
	go func() {
		log := &entity.WorkspaceActivityLog{
			ID:          uuid.New(),
			WorkspaceID: workspaceID,
			UserID:      userID,
			Action:      action,
			EntityType:  entityType,
			EntityID:    entityID,
			Metadata:    metadata,
		}
		_ = uc.repo.LogActivity(ctx, log)
	}()
}

// --- Shared finance data (two-query, no subquery JOIN) ---

func (uc *workspaceUseCase) GetMemberUserIDsForScope(ctx context.Context, workspaceID, requestingUserID uuid.UUID) ([]uuid.UUID, error) {
	if _, err := uc.requireMembership(ctx, workspaceID, requestingUserID); err != nil {
		return nil, err
	}
	return uc.repo.GetMemberUserIDs(ctx, workspaceID)
}

func (uc *workspaceUseCase) GetWorkspaceTransactions(ctx context.Context, workspaceID, requestingUserID uuid.UUID, q domainrepo.ListTransactionsQuery) ([]domainuc.WorkspaceTxRow, int64, error) {
	members, err := uc.repo.ListMembers(ctx, workspaceID)
	if err != nil {
		return nil, 0, err
	}
	isMember := false
	nameByID := make(map[uuid.UUID]string, len(members))
	for _, m := range members {
		nameByID[m.UserID] = ""
		if m.UserID == requestingUserID {
			isMember = true
		}
	}
	if !isMember {
		return nil, 0, ErrNotWorkspaceMember
	}

	// Enrich member names via user repo
	for uid := range nameByID {
		if u, err := uc.userRepo.FindByID(ctx, uid); err == nil && u != nil {
			nameByID[uid] = u.Name
		}
	}

	// Query 1: member IDs (already have from members slice above)
	userIDs := make([]uuid.UUID, 0, len(members))
	for _, m := range members {
		userIDs = append(userIDs, m.UserID)
	}

	// Query 2: transactions WHERE user_id IN (literal IDs)
	txs, total, err := uc.txRepo.FindAllByUserIDs(ctx, userIDs, q)
	if err != nil {
		return nil, 0, err
	}

	rows := make([]domainuc.WorkspaceTxRow, len(txs))
	for i, tx := range txs {
		rows[i] = domainuc.WorkspaceTxRow{
			Transaction: tx,
			MemberName:  nameByID[tx.UserID],
			MemberID:    tx.UserID,
		}
	}
	return rows, total, nil
}

func (uc *workspaceUseCase) GetWorkspaceSummary(ctx context.Context, workspaceID, requestingUserID uuid.UUID, start, end time.Time) (*domainrepo.TransactionSummary, error) {
	userIDs, err := uc.GetMemberUserIDsForScope(ctx, workspaceID, requestingUserID)
	if err != nil {
		return nil, err
	}
	return uc.txRepo.GetSummaryByUserIDs(ctx, userIDs, start, end)
}

func (uc *workspaceUseCase) GetWorkspaceCategoryBreakdown(ctx context.Context, workspaceID, requestingUserID uuid.UUID, txType string, start, end time.Time) ([]domainrepo.CategoryBreakdownRow, error) {
	userIDs, err := uc.GetMemberUserIDsForScope(ctx, workspaceID, requestingUserID)
	if err != nil {
		return nil, err
	}
	return uc.txRepo.GetCategoryBreakdownByUserIDs(ctx, userIDs, txType, start, end)
}
