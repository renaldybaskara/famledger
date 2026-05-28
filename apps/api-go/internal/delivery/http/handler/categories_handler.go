package handler

import (
	"net/http"

	httputil "github.com/fintrackr/api/internal/delivery/http/httputil"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CategoriesHandler struct {
	uc domainuc.CategoryUseCase
}

func NewCategoriesHandler(uc domainuc.CategoryUseCase) *CategoriesHandler {
	return &CategoriesHandler{uc: uc}
}

type createCategoryRequest struct {
	Name      string  `json:"name" binding:"required"`
	NameEn    *string `json:"nameEn"`
	Icon      string  `json:"icon" binding:"required"`
	Color     string  `json:"color" binding:"required"`
	Type      string  `json:"type" binding:"required,oneof=income expense transfer"`
	SortOrder *int    `json:"sortOrder"`
}

type updateCategoryRequest struct {
	Name      *string `json:"name"`
	NameEn    *string `json:"nameEn"`
	Icon      *string `json:"icon"`
	Color     *string `json:"color"`
	SortOrder *int    `json:"sortOrder"`
}

// GET /api/categories
func (h *CategoriesHandler) FindAll(c *gin.Context) {
	userID := c.MustGet("currentUserID").(uuid.UUID)
	cats, err := h.uc.FindAll(c.Request.Context(), userID)
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	httputil.OK(c, cats)
}

// POST /api/categories
func (h *CategoriesHandler) Create(c *gin.Context) {
	var req createCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	userID := c.MustGet("currentUserID").(uuid.UUID)
	cat, err := h.uc.Create(c.Request.Context(), userID, domainuc.CreateCategoryInput{
		Name:      req.Name,
		NameEn:    req.NameEn,
		Icon:      req.Icon,
		Color:     req.Color,
		Type:      req.Type,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		httputil.InternalError(c, err)
		return
	}
	c.JSON(http.StatusCreated, cat)
}

// PATCH /api/categories/:id
func (h *CategoriesHandler) Update(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.BadRequest(c, "Invalid category ID")
		return
	}

	var req updateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httputil.ValidationError(c, err)
		return
	}

	userID := c.MustGet("currentUserID").(uuid.UUID)
	cat, err := h.uc.Update(c.Request.Context(), userID, id, domainuc.UpdateCategoryInput{
		Name:      req.Name,
		NameEn:    req.NameEn,
		Icon:      req.Icon,
		Color:     req.Color,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		if err.Error() == "category not found" {
			httputil.NotFound(c, "Category not found")
			return
		}
		httputil.Forbidden(c, err.Error())
		return
	}
	httputil.OK(c, cat)
}

// DELETE /api/categories/:id
func (h *CategoriesHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		httputil.BadRequest(c, "Invalid category ID")
		return
	}

	userID := c.MustGet("currentUserID").(uuid.UUID)
	if err := h.uc.Delete(c.Request.Context(), userID, id); err != nil {
		if err.Error() == "category not found" {
			httputil.NotFound(c, "Category not found")
			return
		}
		httputil.Forbidden(c, err.Error())
		return
	}
	httputil.OK(c, gin.H{"message": "Category deleted successfully"})
}

