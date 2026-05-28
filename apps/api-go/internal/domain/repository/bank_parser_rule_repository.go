package repository

import (
	"context"

	"github.com/fintrackr/api/internal/domain/entity"
)

// BankParserRuleRepository manages the user-defined email parsing rules.
type BankParserRuleRepository interface {
	// FindAllActive returns all active global rules ordered by priority ASC.
	FindAllActive(ctx context.Context) ([]entity.BankParserRule, error)

	// FindAll returns every rule (including inactive) for the admin UI.
	FindAll(ctx context.Context) ([]entity.BankParserRule, error)

	// FindByID returns one rule by primary key.
	FindByID(ctx context.Context, id uint) (*entity.BankParserRule, error)

	// FindByName returns a rule by its unique name (case-insensitive).
	FindByName(ctx context.Context, name string) (*entity.BankParserRule, error)

	// Create inserts a new rule.
	Create(ctx context.Context, rule *entity.BankParserRule) error

	// Update applies partial updates to a rule.
	Update(ctx context.Context, id uint, data map[string]interface{}) (*entity.BankParserRule, error)

	// Delete permanently removes a rule.
	Delete(ctx context.Context, id uint) error
}
