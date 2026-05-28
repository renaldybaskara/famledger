package usecase

import "context"

type SMTPSettingsInput struct {
	Host    string `json:"host"`
	Port    string `json:"port"`
	User    string `json:"user"`
	Pass    string `json:"pass"`
	From    string `json:"from"`
	Enabled bool   `json:"enabled"`
}

type SMTPSettingsOutput struct {
	Host    string `json:"host"`
	Port    string `json:"port"`
	User    string `json:"user"`
	HasPass bool   `json:"hasPass"` // never expose the actual password
	From    string `json:"from"`
	Enabled bool   `json:"enabled"`
}

type SettingsUseCase interface {
	GetSMTPSettings(ctx context.Context) (*SMTPSettingsOutput, error)
	SaveSMTPSettings(ctx context.Context, in SMTPSettingsInput) error
	TestSMTP(ctx context.Context, testEmail string) error
}
