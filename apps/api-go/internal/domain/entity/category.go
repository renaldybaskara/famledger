package entity

import (
	"time"

	"github.com/google/uuid"
)

type Category struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    *uuid.UUID `gorm:"type:uuid;index" json:"userId,omitempty"` // null = global default
	Name      string     `gorm:"not null;size:100" json:"name"`
	NameEn    *string    `gorm:"size:100" json:"nameEn,omitempty"`
	Icon      string     `gorm:"not null;size:50" json:"icon"`
	Color     string     `gorm:"not null;size:7" json:"color"`
	Type      string     `gorm:"not null;size:20" json:"type"` // income|expense|transfer
	ParentID  *uuid.UUID `gorm:"type:uuid" json:"parentId,omitempty"`
	IsDefault bool       `gorm:"default:false;not null" json:"isDefault"`
	IsActive  bool       `gorm:"default:true;not null" json:"isActive"`
	SortOrder int        `gorm:"default:0" json:"sortOrder"`
	CreatedAt time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (Category) TableName() string {
	return "categories"
}

type CategoryRule struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID     *uuid.UUID `gorm:"type:uuid;index" json:"userId,omitempty"`
	CategoryID uuid.UUID  `gorm:"type:uuid;not null;index" json:"categoryId"`
	RuleType   string     `gorm:"not null;size:50" json:"ruleType"`
	Pattern    string     `gorm:"not null" json:"pattern"`
	Priority   int        `gorm:"default:0" json:"priority"`
	IsGlobal   bool       `gorm:"default:false" json:"isGlobal"`
	IsActive   bool       `gorm:"default:true;not null" json:"isActive"`
	CreatedAt  time.Time  `gorm:"autoCreateTime" json:"createdAt"`
}

func (CategoryRule) TableName() string {
	return "category_rules"
}
