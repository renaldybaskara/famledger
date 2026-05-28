package usecase

import (
	"context"
	"errors"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	"github.com/google/uuid"
)

type userUseCase struct {
	userRepo domainrepo.UserRepository
}

func NewUserUseCase(userRepo domainrepo.UserRepository) domainuc.UserUseCase {
	return &userUseCase{userRepo: userRepo}
}

func (uc *userUseCase) GetProfile(ctx context.Context, userID uuid.UUID) (*entity.User, error) {
	user, err := uc.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}
	return user, nil
}

func (uc *userUseCase) UpdateProfile(ctx context.Context, userID uuid.UUID, in domainuc.UpdateProfileInput) (*entity.User, error) {
	data := make(map[string]interface{})
	if in.Name != nil {
		data["name"] = *in.Name
	}
	if in.AvatarURL != nil {
		data["avatar_url"] = *in.AvatarURL
	}
	if len(data) == 0 {
		return uc.GetProfile(ctx, userID)
	}
	return uc.userRepo.Update(ctx, userID, data)
}
