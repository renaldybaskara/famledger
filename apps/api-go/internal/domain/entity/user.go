package entity

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID                     uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email                  string     `gorm:"uniqueIndex;not null;size:255" json:"email"`
	PasswordHash           *string    `gorm:"size:255" json:"-"`
	Name                   string     `gorm:"not null;size:255" json:"name"`
	AvatarURL              *string    `gorm:"column:avatar_url" json:"avatarUrl,omitempty"`
	Tier                   string     `gorm:"default:free;not null;size:20" json:"tier"`
	AuthProvider           string     `gorm:"default:email;not null;size:20" json:"authProvider"`
	GoogleID               *string    `gorm:"size:255;column:google_id" json:"-"`
	IsEmailVerified        bool       `gorm:"default:false;not null" json:"isEmailVerified"`
	EmailVerificationToken *string    `gorm:"size:255" json:"-"`
	PasswordResetToken     *string    `gorm:"size:255" json:"-"`
	PasswordResetExpires   *time.Time `json:"-"`
	TwoFactorSecret        *string    `gorm:"size:255" json:"-"`
	TwoFactorEnabled       bool       `gorm:"default:false;not null" json:"twoFactorEnabled"`
	SelfHostedAdmin        bool       `gorm:"default:false;not null" json:"selfHostedAdmin"`
	DeletedAt              *time.Time `json:"-"`
	CreatedAt              time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt              time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (User) TableName() string {
	return "users"
}

// SafeUser returns a user without any sensitive fields
func (u *User) Safe() map[string]interface{} {
	return map[string]interface{}{
		"id":               u.ID,
		"email":            u.Email,
		"name":             u.Name,
		"avatarUrl":        u.AvatarURL,
		"tier":             u.Tier,
		"authProvider":     u.AuthProvider,
		"isEmailVerified":  u.IsEmailVerified,
		"twoFactorEnabled": u.TwoFactorEnabled,
		"selfHostedAdmin":  u.SelfHostedAdmin,
		"createdAt":        u.CreatedAt,
		"updatedAt":        u.UpdatedAt,
	}
}
