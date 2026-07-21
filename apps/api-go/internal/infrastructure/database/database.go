package database

import (
	"fmt"
	"time"

	"github.com/fintrackr/api/internal/domain/entity"
	"github.com/fintrackr/api/internal/infrastructure/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect(cfg *config.Config) (*gorm.DB, error) {
	logLevel := logger.Silent
	if cfg.AppEnv != "production" {
		logLevel = logger.Info
	}

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		Logger:                 logger.Default.LogMode(logLevel),
		PrepareStmt:            true,
		SkipDefaultTransaction: false,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	return db, nil
}

func AutoMigrate(db *gorm.DB) error {
	if err := db.Exec(`
		CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_date
		ON transactions (user_id, date DESC)
		WHERE deleted_at IS NULL
	`).Error; err != nil {
		_ = err
	}

	// Drop the old global unique index on message_id (replaced by the composite
	// index on (email_integration_id, message_id) so each user gets their own row
	// when multiple integrations poll the same inbox).
	_ = db.Exec(`DROP INDEX IF EXISTS idx_email_messages_message_id`).Error

	return db.AutoMigrate(
		&entity.User{},
		&entity.RefreshToken{},
		&entity.Account{},
		&entity.EmailIntegration{},
		&entity.Category{},
		&entity.CategoryRule{},
		&entity.Transaction{},
		&entity.TransactionAuditLog{},
		&entity.Budget{},
		&entity.Subscription{},
		// Workspace
		&entity.Workspace{},
		&entity.WorkspaceMember{},
		&entity.WorkspaceInvite{},
		&entity.WorkspaceActivityLog{},
		// System
		&entity.SystemSetting{},
		// Email import pipeline
		&entity.EmailMessage{},
		// Admin-managed bank parser rules
		&entity.BankParserRule{},
		// Subscription billing
		&entity.UserSubscription{},
		// Savings Goals
		&entity.SavingsGoal{},
		&entity.SavingsGoalSource{},
		&entity.SavingsGoalContribution{},
		&entity.SavingsGoalAllocation{},
	)
}
