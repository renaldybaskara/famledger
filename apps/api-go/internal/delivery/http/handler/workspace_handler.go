package handler

import (
	"math"
	"net/http"
	"strconv"
	"time"

	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/fintrackr/api/internal/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type WorkspaceHandler struct {
	uc domainuc.WorkspaceUseCase
}

func NewWorkspaceHandler(uc domainuc.WorkspaceUseCase) *WorkspaceHandler {
	return &WorkspaceHandler{uc: uc}
}

// POST /api/workspaces
func (h *WorkspaceHandler) Create(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)

	var req struct {
		Name        string                `json:"name" binding:"required,min=2,max=255"`
		Description *string               `json:"description"`
		Tier        entity.WorkspaceTier  `json:"tier"`
		Currency    string                `json:"currency"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	ws, err := h.uc.Create(c.Request.Context(), userID, domainuc.CreateWorkspaceInput{
		Name:        req.Name,
		Description: req.Description,
		Tier:        req.Tier,
		Currency:    req.Currency,
	})
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": ws})
}

// GET /api/workspaces
func (h *WorkspaceHandler) List(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)

	workspaces, err := h.uc.ListForUser(c.Request.Context(), userID)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, workspaces)
}

// GET /api/workspaces/:id
func (h *WorkspaceHandler) GetByID(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	wsID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid workspace ID")
		return
	}

	ws, err := h.uc.GetByID(c.Request.Context(), wsID, userID)
	if err != nil {
		switch err {
		case usecase.ErrWorkspaceNotFound:
			httputil.NotFound(c, "Workspace not found")
		case usecase.ErrNotWorkspaceMember:
			httputil.Forbidden(c, "Access denied")
		default:
			httputil.InternalError(c, err)
		}
		return
	}
	httputil.OK(c, ws)
}

// PATCH /api/workspaces/:id
func (h *WorkspaceHandler) Update(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	wsID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid workspace ID")
		return
	}

	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		Currency    *string `json:"currency"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	ws, err := h.uc.Update(c.Request.Context(), wsID, userID, domainuc.UpdateWorkspaceInput{
		Name:        req.Name,
		Description: req.Description,
		Currency:    req.Currency,
	})
	if err != nil {
		workspaceError(c, err)
		return
	}
	httputil.OK(c, ws)
}

// DELETE /api/workspaces/:id
func (h *WorkspaceHandler) Delete(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	wsID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid workspace ID")
		return
	}

	if err := h.uc.Delete(c.Request.Context(), wsID, userID); err != nil {
		workspaceError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Workspace deleted"})
}

// GET /api/workspaces/:id/members
func (h *WorkspaceHandler) ListMembers(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	wsID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid workspace ID")
		return
	}

	members, err := h.uc.ListMembers(c.Request.Context(), wsID, userID)
	if err != nil {
		workspaceError(c, err)
		return
	}
	type memberDTO struct {
		UserID   string `json:"userId"`
		Name     string `json:"name"`
		Email    string `json:"email"`
		Role     string `json:"role"`
		JoinedAt string `json:"joinedAt"`
	}
	dto := make([]memberDTO, 0, len(members))
	for _, m := range members {
		name, email := "", ""
		if m.User != nil {
			name = m.User.Name
			email = m.User.Email
		}
		dto = append(dto, memberDTO{
			UserID:   m.UserID.String(),
			Name:     name,
			Email:    email,
			Role:     string(m.Role),
			JoinedAt: m.JoinedAt.Format("2006-01-02T15:04:05Z"),
		})
	}
	httputil.OK(c, dto)
}

// PATCH /api/workspaces/:id/members/:userId
func (h *WorkspaceHandler) UpdateMemberRole(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	wsID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid workspace ID")
		return
	}
	targetID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		httputil.BadRequest(c, "Invalid user ID")
		return
	}

	var req struct {
		Role entity.WorkspaceRole `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	if err := h.uc.UpdateMemberRole(c.Request.Context(), wsID, targetID, userID, req.Role); err != nil {
		workspaceError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Member role updated"})
}

// DELETE /api/workspaces/:id/members/:userId
func (h *WorkspaceHandler) RemoveMember(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	wsID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid workspace ID")
		return
	}
	targetID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		httputil.BadRequest(c, "Invalid user ID")
		return
	}

	if err := h.uc.RemoveMember(c.Request.Context(), wsID, targetID, userID); err != nil {
		workspaceError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Member removed"})
}

// DELETE /api/workspaces/:id/leave
func (h *WorkspaceHandler) Leave(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	wsID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid workspace ID")
		return
	}

	if err := h.uc.LeaveWorkspace(c.Request.Context(), wsID, userID); err != nil {
		workspaceError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Left workspace"})
}

// POST /api/workspaces/:id/invites
func (h *WorkspaceHandler) InviteMember(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	wsID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid workspace ID")
		return
	}

	var req struct {
		Email string               `json:"email" binding:"required,email"`
		Role  entity.WorkspaceRole `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	invite, err := h.uc.InviteMember(c.Request.Context(), wsID, userID, domainuc.InviteMemberInput{
		Email: req.Email,
		Role:  req.Role,
	})
	if err != nil {
		switch err {
		case usecase.ErrAlreadyMember:
			httputil.Conflict(c, "User is already a member of this workspace")
		case usecase.ErrInviteAlreadySent:
			httputil.Conflict(c, "An invite has already been sent to this email")
		default:
			workspaceError(c, err)
		}
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": invite})
}

// GET /api/workspaces/:id/invites
func (h *WorkspaceHandler) ListInvites(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	wsID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid workspace ID")
		return
	}

	invites, err := h.uc.ListInvites(c.Request.Context(), wsID, userID)
	if err != nil {
		workspaceError(c, err)
		return
	}
	httputil.OK(c, invites)
}

// DELETE /api/workspaces/:id/invites/:inviteId
func (h *WorkspaceHandler) RevokeInvite(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	wsID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid workspace ID")
		return
	}
	inviteID, err := uuid.Parse(c.Param("inviteId"))
	if err != nil {
		httputil.BadRequest(c, "Invalid invite ID")
		return
	}

	if err := h.uc.RevokeInvite(c.Request.Context(), inviteID, wsID, userID); err != nil {
		workspaceError(c, err)
		return
	}
	httputil.OK(c, gin.H{"message": "Invite revoked"})
}

// POST /api/workspaces/invites/accept
func (h *WorkspaceHandler) AcceptInvite(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)

	token := c.Query("token")
	if token == "" {
		var req struct {
			Token string `json:"token" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			httputil.ValidationError(c, err)
			return
		}
		token = req.Token
	}

	member, err := h.uc.AcceptInvite(c.Request.Context(), token, userID)
	if err != nil {
		switch err {
		case usecase.ErrInviteNotFound:
			httputil.NotFound(c, "Invite not found or expired")
		case usecase.ErrAlreadyMember:
			httputil.Conflict(c, "Already a member of this workspace")
		default:
			workspaceError(c, err)
		}
		return
	}
	httputil.OK(c, member)
}

// POST /api/workspaces/invites/decline
func (h *WorkspaceHandler) DeclineInvite(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)

	token := c.Query("token")
	if token == "" {
		var req struct {
			Token string `json:"token" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			httputil.ValidationError(c, err)
			return
		}
		token = req.Token
	}

	if err := h.uc.DeclineInvite(c.Request.Context(), token, userID); err != nil {
		switch err {
		case usecase.ErrInviteNotFound:
			httputil.NotFound(c, "Invite not found or expired")
		default:
			workspaceError(c, err)
		}
		return
	}
	httputil.OK(c, gin.H{"message": "Invite declined"})
}

// GET /api/workspaces/:id/activity
func (h *WorkspaceHandler) ListActivity(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	wsID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid workspace ID")
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	logs, err := h.uc.ListActivity(c.Request.Context(), wsID, userID, limit)
	if err != nil {
		workspaceError(c, err)
		return
	}
	httputil.OK(c, logs)
}

// GET /api/workspaces/invites/pending
func (h *WorkspaceHandler) GetMyPendingInvites(c *gin.Context) {
	user := c.MustGet("currentUser").(*entity.User)
	invites, err := h.uc.GetMyPendingInvites(c.Request.Context(), user.Email)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	// Build response including token so the invitee can accept/decline in-app.
	type inviteResp struct {
		entity.WorkspaceInvite
		Token string `json:"token"`
	}
	resp := make([]inviteResp, len(invites))
	for i, inv := range invites {
		resp[i] = inviteResp{WorkspaceInvite: inv, Token: inv.Token}
	}
	httputil.OK(c, resp)
}

// GET /api/workspaces/:id/transactions
func (h *WorkspaceHandler) GetWorkspaceTransactions(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	wsID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid workspace ID")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	q := domainrepo.ListTransactionsQuery{
		Page:   page,
		Limit:  limit,
		Type:   c.Query("type"),
		Search: c.Query("search"),
	}
	if s := c.Query("startDate"); s != "" {
		t, err := time.ParseInLocation("2006-01-02", s, wibLoc)
		if err == nil {
			q.StartDate = &t
		}
	}
	if s := c.Query("endDate"); s != "" {
		t, err := time.ParseInLocation("2006-01-02", s, wibLoc)
		if err == nil {
			t = t.Add(24*time.Hour - time.Nanosecond)
			q.EndDate = &t
		}
	}

	rows, total, err := h.uc.GetWorkspaceTransactions(c.Request.Context(), wsID, userID, q)
	if err != nil {
		workspaceError(c, err)
		return
	}

	if limit < 1 {
		limit = 20
	}
	if page < 1 {
		page = 1
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages < 1 {
		totalPages = 1
	}

	httputil.OK(c, gin.H{
		"data": rows,
		"pagination": gin.H{
			"page": page, "limit": limit,
			"total": total, "totalPages": totalPages,
		},
	})
}

// GET /api/workspaces/:id/summary
func (h *WorkspaceHandler) GetWorkspaceSummary(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	wsID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid workspace ID")
		return
	}
	start, end := parseOrCurrentMonth(c.Query("startDate"), c.Query("endDate"))

	summary, err := h.uc.GetWorkspaceSummary(c.Request.Context(), wsID, userID, start, end)
	if err != nil {
		workspaceError(c, err)
		return
	}
	httputil.OK(c, gin.H{
		"totalIncome": summary.Income, "totalExpense": summary.Expense,
		"netBalance": summary.Net, "transactionCount": summary.TransactionCount,
		"period": gin.H{"startDate": start.Format("2006-01-02"), "endDate": end.Format("2006-01-02")},
	})
}

// GET /api/workspaces/:id/category-breakdown
func (h *WorkspaceHandler) GetWorkspaceCategoryBreakdown(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	wsID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httputil.BadRequest(c, "Invalid workspace ID")
		return
	}
	txType := c.DefaultQuery("type", "expense")
	start, end := parseOrCurrentMonth(c.Query("startDate"), c.Query("endDate"))

	rows, err := h.uc.GetWorkspaceCategoryBreakdown(c.Request.Context(), wsID, userID, txType, start, end)
	if err != nil {
		workspaceError(c, err)
		return
	}
	httputil.OK(c, rows)
}

func workspaceError(c *gin.Context, err error) {
	switch err {
	case usecase.ErrWorkspaceNotFound:
		httputil.NotFound(c, "Workspace not found")
	case usecase.ErrNotWorkspaceMember:
		httputil.Forbidden(c, "You are not a member of this workspace")
	case usecase.ErrInsufficientPermission:
		httputil.Forbidden(c, "Insufficient permissions")
	case usecase.ErrCannotRemoveOwner:
		httputil.BadRequest(c, "Cannot remove the workspace owner")
	default:
		httputil.InternalError(c, err)
	}
}
