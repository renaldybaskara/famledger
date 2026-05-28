package usecase

import (
	"context"
	"fmt"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	domainuc "github.com/fintrackr/api/internal/domain/usecase"
	emailsvc "github.com/fintrackr/api/internal/infrastructure/email"
	"github.com/fintrackr/api/internal/infrastructure/config"
)

type settingsUseCase struct {
	settingRepo domainrepo.SystemSettingRepository
	emailSvc    emailsvc.EmailService
	cfg         *config.Config
}

func NewSettingsUseCase(
	settingRepo domainrepo.SystemSettingRepository,
	emailSvc emailsvc.EmailService,
	cfg *config.Config,
) domainuc.SettingsUseCase {
	return &settingsUseCase{
		settingRepo: settingRepo,
		emailSvc:    emailSvc,
		cfg:         cfg,
	}
}

func (uc *settingsUseCase) GetSMTPSettings(ctx context.Context) (*domainuc.SMTPSettingsOutput, error) {
	settings, err := uc.settingRepo.GetMany(ctx, domainrepo.SMTPKeys)
	if err != nil {
		return nil, err
	}

	// Build output — merge DB + env fallback, never expose password
	host := coalesceStr(settings[entity.SettingKeySmtpHost], uc.cfg.SMTPHost)
	port := coalesceStr(settings[entity.SettingKeySmtpPort], uc.cfg.SMTPPort)
	user := coalesceStr(settings[entity.SettingKeySmtpUser], uc.cfg.SMTPUser)
	from := coalesceStr(settings[entity.SettingKeySmtpFrom], user)
	enabledStr := settings[entity.SettingKeySmtpEnabled]

	hasPass := settings[entity.SettingKeySmtpPass] != "" || uc.cfg.SMTPPass != ""
	enabled := enabledStr == "true" || (enabledStr == "" && host != "" && user != "" && hasPass)

	if port == "" {
		port = "587"
	}

	return &domainuc.SMTPSettingsOutput{
		Host:    host,
		Port:    port,
		User:    user,
		HasPass: hasPass,
		From:    from,
		Enabled: enabled,
	}, nil
}

func (uc *settingsUseCase) SaveSMTPSettings(ctx context.Context, in domainuc.SMTPSettingsInput) error {
	settings := map[string]string{
		entity.SettingKeySmtpHost:    in.Host,
		entity.SettingKeySmtpPort:    in.Port,
		entity.SettingKeySmtpUser:    in.User,
		entity.SettingKeySmtpFrom:    in.From,
		entity.SettingKeySmtpEnabled: fmt.Sprintf("%t", in.Enabled),
	}

	// Only update password if provided (non-empty)
	if in.Pass != "" {
		settings[entity.SettingKeySmtpPass] = in.Pass
	}

	return uc.settingRepo.SetMany(ctx, settings)
}

func (uc *settingsUseCase) TestSMTP(ctx context.Context, testEmail string) error {
	return uc.emailSvc.SendVerificationEmail(testEmail, "Test User", "test-token-not-real")
}

func coalesceStr(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
