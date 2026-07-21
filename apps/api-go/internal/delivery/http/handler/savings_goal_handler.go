package handler

import (
	"net/http"
	"strconv"

	domainUsecase "github.com/fintrackr/api/internal/domain/usecase"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SavingsGoalHandler struct {
	usecase domainUsecase.SavingsGoalUsecase
}

func NewSavingsGoalHandler(usecase domainUsecase.SavingsGoalUsecase) *SavingsGoalHandler {
	return &SavingsGoalHandler{usecase: usecase}
}

// POST /api/savings-goals
func (h *SavingsGoalHandler) CreateGoal(c *gin.Context) {
	userID := c.MustGet("userId").(uuid.UUID)

	var input domainUsecase.CreateGoalInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	input.UserID = userID

	goal, err := h.usecase.CreateGoal(input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, goal)
}

// GET /api/savings-goals
func (h *SavingsGoalHandler) ListGoals(c *gin.Context) {
	userID := c.MustGet("userId").(uuid.UUID)
	status := c.DefaultQuery("status", "active")
	workspaceID := c.Query("workspaceId")

	if workspaceID != "" {
		wsID, err := uuid.Parse(workspaceID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid workspaceId"})
			return
		}
		goals, err := h.usecase.ListWorkspaceGoals(wsID, status)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, goals)
		return
	}

	goals, err := h.usecase.ListGoals(userID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, goals)
}

// GET /api/savings-goals/:id
func (h *SavingsGoalHandler) GetGoal(c *gin.Context) {
	userID := c.MustGet("userId").(uuid.UUID)
	goalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid goal id"})
		return
	}

	goal, err := h.usecase.GetGoal(goalID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "goal not found"})
		return
	}
	c.JSON(http.StatusOK, goal)
}

// PATCH /api/savings-goals/:id
func (h *SavingsGoalHandler) UpdateGoal(c *gin.Context) {
	userID := c.MustGet("userId").(uuid.UUID)
	goalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid goal id"})
		return
	}

	var input domainUsecase.UpdateGoalInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	goal, err := h.usecase.UpdateGoal(goalID, userID, input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, goal)
}

// DELETE /api/savings-goals/:id
func (h *SavingsGoalHandler) DeleteGoal(c *gin.Context) {
	userID := c.MustGet("userId").(uuid.UUID)
	goalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid goal id"})
		return
	}

	if err := h.usecase.DeleteGoal(goalID, userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "goal deleted"})
}

// PATCH /api/savings-goals/:id/status
func (h *SavingsGoalHandler) UpdateGoalStatus(c *gin.Context) {
	userID := c.MustGet("userId").(uuid.UUID)
	goalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid goal id"})
		return
	}

	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.usecase.UpdateGoalStatus(goalID, userID, body.Status); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "status updated"})
}

// --- Sources ---

// POST /api/savings-goals/:id/sources
func (h *SavingsGoalHandler) AddSource(c *gin.Context) {
	userID := c.MustGet("userId").(uuid.UUID)
	goalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid goal id"})
		return
	}

	var input domainUsecase.AddSourceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	source, err := h.usecase.AddSource(goalID, userID, input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, source)
}

// GET /api/savings-goals/:id/sources
func (h *SavingsGoalHandler) ListSources(c *gin.Context) {
	goalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid goal id"})
		return
	}

	sources, err := h.usecase.ListSources(goalID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sources)
}

// PATCH /api/savings-goals/:id/sources/:sid
func (h *SavingsGoalHandler) UpdateSource(c *gin.Context) {
	userID := c.MustGet("userId").(uuid.UUID)
	sourceID, err := uuid.Parse(c.Param("sid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid source id"})
		return
	}

	var input domainUsecase.UpdateSourceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	source, err := h.usecase.UpdateSource(sourceID, userID, input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, source)
}

// DELETE /api/savings-goals/:id/sources/:sid
func (h *SavingsGoalHandler) DeleteSource(c *gin.Context) {
	userID := c.MustGet("userId").(uuid.UUID)
	sourceID, err := uuid.Parse(c.Param("sid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid source id"})
		return
	}

	if err := h.usecase.DeleteSource(sourceID, userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "source deleted"})
}

// --- Contributions ---

// POST /api/savings-goals/:id/contributions
func (h *SavingsGoalHandler) AddContribution(c *gin.Context) {
	userID := c.MustGet("userId").(uuid.UUID)
	goalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid goal id"})
		return
	}

	var input domainUsecase.AddContributionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	contribution, err := h.usecase.AddContribution(goalID, userID, input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, contribution)
}

// GET /api/savings-goals/:id/contributions
func (h *SavingsGoalHandler) ListContributions(c *gin.Context) {
	goalID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid goal id"})
		return
	}

	contribType := c.Query("type")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	contributions, total, err := h.usecase.ListContributions(goalID, contribType, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  contributions,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// --- Allocations ---

// GET /api/savings-goals/allocations
func (h *SavingsGoalHandler) GetAllocations(c *gin.Context) {
	userID := c.MustGet("userId").(uuid.UUID)

	allocations, err := h.usecase.GetAllocations(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, allocations)
}

// PUT /api/savings-goals/allocations
func (h *SavingsGoalHandler) SetAllocations(c *gin.Context) {
	userID := c.MustGet("userId").(uuid.UUID)

	var input []domainUsecase.SetAllocationInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.usecase.SetAllocations(userID, input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "allocations updated"})
}

// --- Summary ---

// GET /api/savings-goals/summary
func (h *SavingsGoalHandler) GetSummary(c *gin.Context) {
	userID := c.MustGet("userId").(uuid.UUID)

	summary, err := h.usecase.GetSummary(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, summary)
}
