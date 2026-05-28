package entity

import "time"

// SystemSetting stores key-value app configuration in the database.
// Keys use dot notation: "smtp.host", "smtp.port", etc.
type SystemSetting struct {
	Key       string    `gorm:"primaryKey;size:100" json:"key"`
	Value     string    `gorm:"type:text;not null" json:"value"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (SystemSetting) TableName() string {
	return "system_settings"
}

// Well-known setting keys
const (
	SettingKeySmtpHost     = "smtp.host"
	SettingKeySmtpPort     = "smtp.port"
	SettingKeySmtpUser     = "smtp.user"
	SettingKeySmtpPass     = "smtp.pass"
	SettingKeySmtpFrom     = "smtp.from"
	SettingKeySmtpEnabled  = "smtp.enabled"

	SettingKeyAppName      = "app.name"
	SettingKeyAppURL       = "app.url"
)
