package handler

import (
	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UsersHandler struct {
	uc domainuc.UserUseCase
}

func NewUsersHandler(uc domainuc.UserUseCase) *UsersHandler {
	return &UsersHandler{uc: uc}
}

type updateProfileRequest struct {
	Name      *string `json:"name"`
	AvatarURL *string `json:"avatarUrl"`
}

// GET /api/users/profile
func (h *UsersHandler) GetProfile(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	user, err := h.uc.GetProfile(c.Request.Context(), userID)
	if err != nil {
		httputil.NotFound(c, "User not found")
		return
	}
	httputil.OK(c, user.Safe())
}

// PATCH /api/users/profile
func (h *UsersHandler) UpdateProfile(c *gin.Context) {
	var req updateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	userID := c.MustGet("currentUserID").(uuid.UUID)
	user, err := h.uc.UpdateProfile(c.Request.Context(), userID, domainuc.UpdateProfileInput{
		Name:      req.Name,
		AvatarURL: req.AvatarURL,
	})
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, user.Safe())
}

