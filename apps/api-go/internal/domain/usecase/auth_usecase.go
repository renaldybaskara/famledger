package usecase

import (
	"context"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/google/uuid"
)

type RegisterInput struct {
	Name     string
	Email    string
	Password string
}

type LoginInput struct {
	Email    string
	Password string
}

type GoogleUserInfo struct {
	Sub     string
	Email   string
	Name    string
	Picture string
}

type AuthOutput struct {
	User         map[string]interface{} `json:"user"`
	AccessToken  string                 `json:"accessToken"`
	RefreshToken string                 `json:"refreshToken"`
}

type AuthUseCase interface {
	Register(ctx context.Context, in RegisterInput) (*AuthOutput, error)
	Login(ctx context.Context, in LoginInput) (*AuthOutput, error)
	RefreshTokens(ctx context.Context, userID uuid.UUID, refreshToken string) (*AuthOutput, error)
	Logout(ctx context.Context, userID uuid.UUID, refreshToken string) error
	GoogleLogin(ctx context.Context, googleUser GoogleUserInfo) (*AuthOutput, error)
	GetMe(ctx context.Context, userID uuid.UUID) (*entity.User, error)

	// Email verification
	SendVerificationEmail(ctx context.Context, userID uuid.UUID) error
	VerifyEmail(ctx context.Context, token string) error

	// Password reset
	ForgotPassword(ctx context.Context, email string) error
	ResetPassword(ctx context.Context, token, newPassword string) error

	// Password change (authenticated)
	ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string) error
}
