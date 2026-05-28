package usecase

import (
	"context"
	"errors"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/google/uuid"
)

type categoryUseCase struct {
	repo domainrepo.CategoryRepository
}

func NewCategoryUseCase(repo domainrepo.CategoryRepository) domainuc.CategoryUseCase {
	return &categoryUseCase{repo: repo}
}

func (uc *categoryUseCase) FindAll(ctx context.Context, userID uuid.UUID) ([]entity.Category, error) {
	return uc.repo.FindAllForUser(ctx, userID)
}

func (uc *categoryUseCase) Create(ctx context.Context, userID uuid.UUID, in domainuc.CreateCategoryInput) (*entity.Category, error) {
	sortOrder := 0
	if in.SortOrder != nil {
		sortOrder = *in.SortOrder
	}
	cat := &entity.Category{
		ID:        uuid.New(),
		UserID:    &userID,
		Name:      in.Name,
		NameEn:    in.NameEn,
		Icon:      in.Icon,
		Color:     in.Color,
		Type:      in.Type,
		SortOrder: sortOrder,
		IsDefault: false,
		IsActive:  true,
	}
	if err := uc.repo.Create(ctx, cat); err != nil {
		return nil, err
	}
	return cat, nil
}

func (uc *categoryUseCase) Update(ctx context.Context, userID, id uuid.UUID, in domainuc.UpdateCategoryInput) (*entity.Category, error) {
	existing, err := uc.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, errors.New("category not found")
	}
	// Can only update user-owned categories
	if existing.UserID == nil || *existing.UserID != userID {
		return nil, errors.New("cannot modify default category")
	}

	data := make(map[string]interface{})
	if in.Name != nil {
		data["name"] = *in.Name
	}
	if in.NameEn != nil {
		data["name_en"] = *in.NameEn
	}
	if in.Icon != nil {
		data["icon"] = *in.Icon
	}
	if in.Color != nil {
		data["color"] = *in.Color
	}
	if in.SortOrder != nil {
		data["sort_order"] = *in.SortOrder
	}
	return uc.repo.Update(ctx, userID, id, data)
}

func (uc *categoryUseCase) Delete(ctx context.Context, userID, id uuid.UUID) error {
	existing, err := uc.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.New("category not found")
	}
	if existing.UserID == nil || *existing.UserID != userID {
		return errors.New("cannot delete default category")
	}
	return uc.repo.SoftDelete(ctx, userID, id)
}
