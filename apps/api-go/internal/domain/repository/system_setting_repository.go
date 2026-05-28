package repository

import (
	"context"

	"github.com/fintrackr/api/internal/domain/entity"
)

type SystemSettingRepository interface {
	Get(ctx context.Context, key string) (string, error)
	GetMany(ctx context.Context, keys []string) (map[string]string, error)
	Set(ctx context.Context, key, value string) error
	SetMany(ctx context.Context, settings map[string]string) error
}

// SMTPConfig holds resolved SMTP settings (from DB or env fallback)
type SMTPConfig struct {
	Host    string
	Port    string
	User    string
	Pass    string
	From    string
	Enabled bool
}

// SMTPKeys is the list of DB keys for SMTP
var SMTPKeys = []string{
	entity.SettingKeySmtpHost,
	entity.SettingKeySmtpPort,
	entity.SettingKeySmtpUser,
	entity.SettingKeySmtpPass,
	entity.SettingKeySmtpFrom,
	entity.SettingKeySmtpEnabled,
	entity.SettingKeyAppURL,
}
