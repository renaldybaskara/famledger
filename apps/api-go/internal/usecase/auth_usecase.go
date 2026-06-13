package usecase

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	emailsvc "github.com/fintrackr/api/internal/infrastructure/email"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserAlreadyExists  = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrUserNotFound       = errors.New("user not found")
	ErrInvalidToken       = errors.New("invalid or expired token")
	ErrEmailAlreadyVerified = errors.New("email already verified")
	ErrWrongPassword      = errors.New("current password is incorrect")
)

type authUseCase struct {
	userRepo            domainrepo.UserRepository
	rtRepo              domainrepo.RefreshTokenRepository
	workspaceRepo       domainrepo.WorkspaceRepository  // optional — for auto-join on register
	subscriptionUC      domainuc.SubscriptionUseCase    // optional — for 14-day trial creation
	emailSvc            emailsvc.EmailService
	jwtSecret           string
	jwtRefreshSecret    string
	jwtExpiresIn        time.Duration
	jwtRefreshExpiresIn time.Duration
}

func NewAuthUseCase(
	userRepo domainrepo.UserRepository,
	rtRepo domainrepo.RefreshTokenRepository,
	emailSvc emailsvc.EmailService,
	jwtSecret, jwtRefreshSecret, jwtExpiresIn, jwtRefreshExpiresIn string,
) domainuc.AuthUseCase {
	accessDur := parseDuration(jwtExpiresIn, 15*time.Minute)
	refreshDur := parseDuration(jwtRefreshExpiresIn, 30*24*time.Hour)
	return &authUseCase{
		userRepo:            userRepo,
		rtRepo:              rtRepo,
		emailSvc:            emailSvc,
		jwtSecret:           jwtSecret,
		jwtRefreshSecret:    jwtRefreshSecret,
		jwtExpiresIn:        accessDur,
		jwtRefreshExpiresIn: refreshDur,
	}
}

// AuthWithWorkspace is an optional interface implemented by authUseCase.
// It allows main.go to inject the workspace repo after construction.
type AuthWithWorkspace interface {
	domainuc.AuthUseCase
	WithWorkspaceRepo(repo domainrepo.WorkspaceRepository)
}

// WithWorkspaceRepo injects the workspace repo so auth can auto-join invites on register.
func (uc *authUseCase) WithWorkspaceRepo(repo domainrepo.WorkspaceRepository) {
	uc.workspaceRepo = repo
}

// AuthWithSubscription is an optional interface implemented by authUseCase.
// It allows main.go to inject subscriptionUC after both usecases are constructed.
type AuthWithSubscription interface {
	domainuc.AuthUseCase
	WithSubscriptionUC(uc domainuc.SubscriptionUseCase)
}

// WithSubscriptionUC injects the subscription usecase so Register/GoogleLogin can start a trial.
func (uc *authUseCase) WithSubscriptionUC(sub domainuc.SubscriptionUseCase) {
	uc.subscriptionUC = sub
}

func (uc *authUseCase) Register(ctx context.Context, in domainuc.RegisterInput) (*domainuc.AuthOutput, error) {
	existing, err := uc.userRepo.FindByEmail(ctx, in.Email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrUserAlreadyExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	hashStr := string(hash)

	// Generate email verification token
	verifyToken, err := generateSecureToken(32)
	if err != nil {
		return nil, err
	}

	user := &entity.User{
		ID:                     uuid.New(),
		Name:                   in.Name,
		Email:                  in.Email,
		PasswordHash:           &hashStr,
		Tier:                   "free",
		AuthProvider:           "email",
		IsEmailVerified:        false,
		EmailVerificationToken: &verifyToken,
	}
	if err := uc.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}

	// Send verification email (non-blocking — don't fail registration if email fails)
	go func() {
		_ = uc.emailSvc.SendVerificationEmail(user.Email, user.Name, verifyToken)
	}()

	// Auto-join any pending workspace invites for this email address (non-blocking).
	if uc.workspaceRepo != nil {
		go uc.autoJoinWorkspaces(context.Background(), user)
	}

	// Start 14-day Pro trial for new users (non-blocking).
	if uc.subscriptionUC != nil {
		go func() { _ = uc.subscriptionUC.CreateTrial(context.Background(), user.ID) }()
	}

	return uc.buildAuthOutput(ctx, user)
}

func (uc *authUseCase) Login(ctx context.Context, in domainuc.LoginInput) (*domainuc.AuthOutput, error) {
	user, err := uc.userRepo.FindByEmail(ctx, in.Email)
	if err != nil {
		return nil, err
	}
	if user == nil || user.PasswordHash == nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(in.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return uc.buildAuthOutput(ctx, user)
}

func (uc *authUseCase) RefreshTokens(ctx context.Context, userID uuid.UUID, refreshToken string) (*domainuc.AuthOutput, error) {
	// Validate refresh token JWT
	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(refreshToken, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(uc.jwtRefreshSecret), nil
	})
	if err != nil {
		return nil, ErrInvalidToken
	}

	// Validate in DB
	rt, err := uc.rtRepo.FindValid(ctx, userID, refreshToken)
	if err != nil {
		return nil, err
	}
	if rt == nil {
		return nil, ErrInvalidToken
	}

	user, err := uc.userRepo.FindByID(ctx, userID)
	if err != nil || user == nil {
		return nil, ErrUserNotFound
	}

	// Generate new tokens
	newAccess, newRefresh, refreshExpiry, err := uc.generateTokenPair(user.ID, user.Email)
	if err != nil {
		return nil, err
	}

	// Atomic token rotation
	if err := uc.rtRepo.ReplaceToken(ctx, userID, refreshToken, newRefresh, refreshExpiry); err != nil {
		return nil, err
	}

	return &domainuc.AuthOutput{
		User:         user.Safe(),
		AccessToken:  newAccess,
		RefreshToken: newRefresh,
	}, nil
}

func (uc *authUseCase) Logout(ctx context.Context, userID uuid.UUID, refreshToken string) error {
	return uc.rtRepo.Revoke(ctx, userID, refreshToken)
}

func (uc *authUseCase) GoogleLogin(ctx context.Context, googleUser domainuc.GoogleUserInfo) (*domainuc.AuthOutput, error) {
	// Try find by Google ID first
	user, err := uc.userRepo.FindByGoogleID(ctx, googleUser.Sub)
	if err != nil {
		return nil, err
	}

	if user == nil {
		// Try find by email (link existing account)
		user, err = uc.userRepo.FindByEmail(ctx, googleUser.Email)
		if err != nil {
			return nil, err
		}
	}

	if user == nil {
		// Create new user
		user = &entity.User{
			ID:              uuid.New(),
			Name:            googleUser.Name,
			Email:           googleUser.Email,
			AvatarURL:       &googleUser.Picture,
			GoogleID:        &googleUser.Sub,
			AuthProvider:    "google",
			IsEmailVerified: true,
			Tier:            "free",
		}
		if err := uc.userRepo.Create(ctx, user); err != nil {
			return nil, err
		}
		// New user — auto-join any pending workspace invites sent before registration.
		if uc.workspaceRepo != nil {
			go uc.autoJoinWorkspaces(context.Background(), user)
		}
		// Start 14-day Pro trial (non-blocking).
		if uc.subscriptionUC != nil {
			go func() { _ = uc.subscriptionUC.CreateTrial(context.Background(), user.ID) }()
		}
	} else if user.GoogleID == nil {
		// Link Google to existing account
		_, _ = uc.userRepo.Update(ctx, user.ID, map[string]interface{}{
			"google_id":         googleUser.Sub,
			"is_email_verified": true,
		})
	}

	return uc.buildAuthOutput(ctx, user)
}

func (uc *authUseCase) GetMe(ctx context.Context, userID uuid.UUID) (*entity.User, error) {
	user, err := uc.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, ErrUserNotFound
	}
	return user, nil
}

// --- email verification ---

func (uc *authUseCase) SendVerificationEmail(ctx context.Context, userID uuid.UUID) error {
	user, err := uc.userRepo.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if user == nil {
		return ErrUserNotFound
	}
	if user.IsEmailVerified {
		return ErrEmailAlreadyVerified
	}

	token, err := generateSecureToken(32)
	if err != nil {
		return err
	}

	if _, err := uc.userRepo.Update(ctx, userID, map[string]interface{}{
		"email_verification_token": token,
	}); err != nil {
		return err
	}

	return uc.emailSvc.SendVerificationEmail(user.Email, user.Name, token)
}

func (uc *authUseCase) VerifyEmail(ctx context.Context, token string) error {
	user, err := uc.userRepo.FindByEmailVerificationToken(ctx, token)
	if err != nil {
		return err
	}
	if user == nil {
		return ErrInvalidToken
	}
	if user.IsEmailVerified {
		return ErrEmailAlreadyVerified
	}

	_, err = uc.userRepo.Update(ctx, user.ID, map[string]interface{}{
		"is_email_verified":        true,
		"email_verification_token": nil,
	})
	if err != nil {
		return err
	}

	// Send welcome email
	go func() {
		_ = uc.emailSvc.SendWelcomeEmail(user.Email, user.Name)
	}()

	return nil
}

// --- password reset ---

func (uc *authUseCase) ForgotPassword(ctx context.Context, email string) error {
	user, err := uc.userRepo.FindByEmail(ctx, email)
	if err != nil {
		return err
	}
	// Don't reveal whether email exists — silently succeed
	if user == nil {
		return nil
	}

	token, err := generateSecureToken(32)
	if err != nil {
		return err
	}

	expires := time.Now().Add(1 * time.Hour)
	if _, err := uc.userRepo.Update(ctx, user.ID, map[string]interface{}{
		"password_reset_token":   token,
		"password_reset_expires": expires,
	}); err != nil {
		return err
	}

	go func() {
		_ = uc.emailSvc.SendPasswordResetEmail(user.Email, user.Name, token)
	}()

	return nil
}

func (uc *authUseCase) ResetPassword(ctx context.Context, token, newPassword string) error {
	user, err := uc.userRepo.FindByPasswordResetToken(ctx, token)
	if err != nil {
		return err
	}
	if user == nil {
		return ErrInvalidToken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	hashStr := string(hash)

	_, err = uc.userRepo.Update(ctx, user.ID, map[string]interface{}{
		"password_hash":          hashStr,
		"password_reset_token":   nil,
		"password_reset_expires": nil,
	})
	if err != nil {
		return err
	}

	// Revoke all refresh tokens for this user (force re-login)
	_ = uc.rtRepo.RevokeAll(ctx, user.ID)

	return nil
}

// --- password change (authenticated) ---

func (uc *authUseCase) ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string) error {
	user, err := uc.userRepo.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if user == nil {
		return ErrUserNotFound
	}
	if user.PasswordHash == nil {
		// OAuth-only account — set a new password
		hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		hashStr := string(hash)
		_, err = uc.userRepo.Update(ctx, userID, map[string]interface{}{
			"password_hash": hashStr,
		})
		return err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(currentPassword)); err != nil {
		return ErrWrongPassword
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	hashStr := string(hash)
	_, err = uc.userRepo.Update(ctx, userID, map[string]interface{}{
		"password_hash": hashStr,
	})
	return err
}

// --- helpers ---

func (uc *authUseCase) buildAuthOutput(ctx context.Context, user *entity.User) (*domainuc.AuthOutput, error) {
	accessToken, refreshToken, refreshExpiry, err := uc.generateTokenPair(user.ID, user.Email)
	if err != nil {
		return nil, err
	}

	rt := &entity.RefreshToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		Token:     refreshToken,
		ExpiresAt: refreshExpiry,
	}
	if err := uc.rtRepo.Save(ctx, rt); err != nil {
		return nil, err
	}

	return &domainuc.AuthOutput{
		User:         user.Safe(),
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (uc *authUseCase) generateTokenPair(userID uuid.UUID, email string) (accessToken, refreshToken string, refreshExpiry time.Time, err error) {
	now := time.Now()

	// Access token
	accessClaims := jwt.MapClaims{
		"sub":   userID.String(),
		"email": email,
		"iat":   now.Unix(),
		"exp":   now.Add(uc.jwtExpiresIn).Unix(),
	}
	accessToken, err = jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims).SignedString([]byte(uc.jwtSecret))
	if err != nil {
		return
	}

	// Refresh token
	refreshExpiry = now.Add(uc.jwtRefreshExpiresIn)
	refreshClaims := jwt.MapClaims{
		"sub": userID.String(),
		"iat": now.Unix(),
		"exp": refreshExpiry.Unix(),
	}
	refreshToken, err = jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).SignedString([]byte(uc.jwtRefreshSecret))
	return
}

// generateSecureToken generates a cryptographically secure random hex token
func generateSecureToken(bytesLen int) (string, error) {
	b := make([]byte, bytesLen)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// autoJoinWorkspaces looks up pending workspace invites for the new user's email
// and automatically accepts them — so a user can be invited before they register.
func (uc *authUseCase) autoJoinWorkspaces(ctx context.Context, user *entity.User) {
	invites, err := uc.workspaceRepo.FindPendingInvitesByEmail(ctx, user.Email)
	if err != nil || len(invites) == 0 {
		return
	}

	now := time.Now()
	for _, invite := range invites {
		// Create membership
		member := &entity.WorkspaceMember{
			ID:          uuid.New(),
			WorkspaceID: invite.WorkspaceID,
			UserID:      user.ID,
			Role:        invite.Role,
			JoinedAt:    now,
		}
		if err := uc.workspaceRepo.AddMember(ctx, member); err != nil {
			// If already member (race condition), just mark invite accepted and continue.
			_ = uc.workspaceRepo.UpdateInviteStatus(ctx, invite.ID, entity.WorkspaceInviteAccepted, now)
			continue
		}

		// Mark invite as accepted
		_ = uc.workspaceRepo.UpdateInviteStatus(ctx, invite.ID, entity.WorkspaceInviteAccepted, now)

		// Log the activity
		inviteID := invite.ID
		_ = uc.workspaceRepo.LogActivity(ctx, &entity.WorkspaceActivityLog{
			ID:          uuid.New(),
			WorkspaceID: invite.WorkspaceID,
			UserID:      user.ID,
			Action:      "member_joined",
			EntityType:  "workspace_invite",
			EntityID:    &inviteID,
			CreatedAt:   now,
		})
	}
}

// parseDuration parses "15m", "30d", "1h" etc.
func parseDuration(s string, fallback time.Duration) time.Duration {
	if len(s) < 2 {
		return fallback
	}
	unit := s[len(s)-1]
	valueStr := s[:len(s)-1]
	var value int
	fmt.Sscanf(valueStr, "%d", &value)
	switch unit {
	case 'm':
		return time.Duration(value) * time.Minute
	case 'h':
		return time.Duration(value) * time.Hour
	case 'd':
		return time.Duration(value) * 24 * time.Hour
	}
	return fallback
}
