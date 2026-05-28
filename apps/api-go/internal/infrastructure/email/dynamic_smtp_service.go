package email

import (
	"context"
	"fmt"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"github.com/fintrackr/api/internal/infrastructure/config"
)

// DynamicSMTPService resolves SMTP config from the database at send time,
// falling back to environment variables if database has no config.
type DynamicSMTPService struct {
	settingRepo domainrepo.SystemSettingRepository
	envFallback *config.Config
	appURL      string
}

func NewDynamicSMTPService(
	settingRepo domainrepo.SystemSettingRepository,
	cfg *config.Config,
) EmailService {
	return &DynamicSMTPService{
		settingRepo: settingRepo,
		envFallback: cfg,
		appURL:      cfg.AppURL,
	}
}

// resolve loads SMTP config: DB first, env fallback
func (s *DynamicSMTPService) resolve() (*smtpService, error) {
	ctx := context.Background()
	settings, err := s.settingRepo.GetMany(ctx, domainrepo.SMTPKeys)
	if err != nil {
		// If DB read fails, fall back to env silently
		settings = map[string]string{}
	}

	host := coalesce(settings[entity.SettingKeySmtpHost], s.envFallback.SMTPHost)
	port := coalesce(settings[entity.SettingKeySmtpPort], s.envFallback.SMTPPort, "587")
	user := coalesce(settings[entity.SettingKeySmtpUser], s.envFallback.SMTPUser)
	pass := coalesce(settings[entity.SettingKeySmtpPass], s.envFallback.SMTPPass)
	from := coalesce(settings[entity.SettingKeySmtpFrom], user)
	appURL := coalesce(settings[entity.SettingKeyAppURL], s.appURL)

	return &smtpService{
		host:    host,
		port:    port,
		user:    user,
		pass:    pass,
		from:    from,
		appURL:  appURL,
		enabled: host != "" && user != "" && pass != "",
	}, nil
}

func (s *DynamicSMTPService) SendVerificationEmail(to, name, token string) error {
	svc, err := s.resolve()
	if err != nil {
		return fmt.Errorf("smtp resolve: %w", err)
	}
	return svc.SendVerificationEmail(to, name, token)
}

func (s *DynamicSMTPService) SendPasswordResetEmail(to, name, token string) error {
	svc, err := s.resolve()
	if err != nil {
		return fmt.Errorf("smtp resolve: %w", err)
	}
	return svc.SendPasswordResetEmail(to, name, token)
}

func (s *DynamicSMTPService) SendWelcomeEmail(to, name string) error {
	svc, err := s.resolve()
	if err != nil {
		return fmt.Errorf("smtp resolve: %w", err)
	}
	return svc.SendWelcomeEmail(to, name)
}

func (s *DynamicSMTPService) SendWorkspaceInviteEmail(to, inviterName, workspaceName, token string) error {
	svc, err := s.resolve()
	if err != nil {
		return fmt.Errorf("smtp resolve: %w", err)
	}
	return svc.SendWorkspaceInviteEmail(to, inviterName, workspaceName, token)
}

// coalesce returns first non-empty string
func coalesce(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
