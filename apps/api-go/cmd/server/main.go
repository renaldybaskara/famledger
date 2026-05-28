package main

import (
	"context"
	"fmt"
	"log"

	"github.com/fintrackr/api/internal/delivery/http/handler"
	"github.com/fintrackr/api/internal/delivery/http/middleware"
	httpdelivery "github.com/fintrackr/api/internal/delivery/http"
	"github.com/fintrackr/api/internal/infrastructure/config"
	"github.com/fintrackr/api/internal/infrastructure/database"
	emailsvc "github.com/fintrackr/api/internal/infrastructure/email"
	"github.com/fintrackr/api/internal/infrastructure/worker"
	"github.com/fintrackr/api/internal/repository"
	"github.com/fintrackr/api/internal/usecase"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env (ignore error — env vars may be set directly in Docker)
	_ = godotenv.Load()

	// Load config
	cfg := config.Load()

	// Set Gin mode
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Connect to database
	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("❌ Database connection failed: %v", err)
	}
	log.Println("✅ Database connected")

	// Run auto-migrations
	if err := database.AutoMigrate(db); err != nil {
		log.Fatalf("❌ Auto-migration failed: %v", err)
	}
	log.Println("✅ Database migrated")

	// Seed default categories
	if err := database.SeedDefaultCategories(db); err != nil {
		log.Printf("⚠️  Category seeding warning: %v", err)
	} else {
		log.Println("✅ Default categories ready")
	}

	// ── Repositories ────────────────────────────────────────
	userRepo             := repository.NewUserRepository(db)
	rtRepo               := repository.NewRefreshTokenRepository(db)
	accountRepo          := repository.NewAccountRepository(db)
	categoryRepo         := repository.NewCategoryRepository(db)
	transactionRepo      := repository.NewTransactionRepository(db)
	budgetRepo           := repository.NewBudgetRepository(db)
	workspaceRepo        := repository.NewWorkspaceRepository(db)
	emailIntegrationRepo := repository.NewEmailIntegrationRepository(db)
	settingRepo          := repository.NewSystemSettingRepository(db)
	emailMsgRepo         := repository.NewEmailMessageRepository(db)
	parserRuleRepo       := repository.NewBankParserRuleRepository(db)

	// ── Email Service (dynamic — reads SMTP config from DB, falls back to env) ──
	emailService := emailsvc.NewDynamicSMTPService(settingRepo, cfg)

	// ── Use Cases ────────────────────────────────────────────
	authUC := usecase.NewAuthUseCase(
		userRepo, rtRepo, emailService,
		cfg.JWTSecret, cfg.JWTRefreshSecret,
		cfg.JWTExpiresIn, cfg.JWTRefreshExpiresIn,
	)
	// Inject workspace repo so Register can auto-join pending invites.
	if wa, ok := authUC.(usecase.AuthWithWorkspace); ok {
		wa.WithWorkspaceRepo(workspaceRepo)
	}
	userUC              := usecase.NewUserUseCase(userRepo)
	accountUC           := usecase.NewAccountUseCase(accountRepo)
	categoryUC          := usecase.NewCategoryUseCase(categoryRepo)
	transactionUC       := usecase.NewTransactionUseCase(transactionRepo)
	budgetUC            := usecase.NewBudgetUseCase(budgetRepo)
	workspaceUC         := usecase.NewWorkspaceUseCase(workspaceRepo, userRepo, emailService)
	settingsUC          := usecase.NewSettingsUseCase(settingRepo, emailService, cfg)
	// Gmail integration uses a dedicated callback URL separate from auth login
	gmailCallbackURL := cfg.GoogleGmailCallbackURL
	if gmailCallbackURL == "" {
		// Derive from AppURL if not explicitly set
		gmailCallbackURL = cfg.AppURL + "/api/email-integrations/gmail/callback"
	}
	emailIntegrationUC  := usecase.NewEmailIntegrationUseCase(
		emailIntegrationRepo,
		cfg.GoogleClientID, cfg.GoogleClientSecret, gmailCallbackURL,
	)

	// Email import pipeline — shared by both background workers and reprocess endpoint.
	emailImportSvc := usecase.NewEmailImportService(
		emailMsgRepo,
		transactionRepo,
		accountRepo,
		categoryRepo,
		parserRuleRepo,
	)

	// ── Handlers ─────────────────────────────────────────────
	healthHandler           := handler.NewHealthHandler("1.0.0", cfg.AppEnv)
	authHandler             := handler.NewAuthHandler(authUC, cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleCallbackURL)
	usersHandler            := handler.NewUsersHandler(userUC)
	accountsHandler         := handler.NewAccountsHandler(accountUC)
	categoriesHandler       := handler.NewCategoriesHandler(categoryUC)
	transactionsHandler     := handler.NewTransactionsHandler(transactionUC)
	budgetsHandler          := handler.NewBudgetsHandler(budgetUC)
	dashboardHandler        := handler.NewDashboardHandler(transactionUC)
	workspaceHandler        := handler.NewWorkspaceHandler(workspaceUC)
	settingsHandler         := handler.NewSettingsHandler(settingsUC)
	emailIntegrationHandler := handler.NewEmailIntegrationHandler(emailIntegrationUC)
	emailMessageHandler     := handler.NewEmailMessageHandler(emailMsgRepo, emailImportSvc)
	bankParserRuleHandler   := handler.NewBankParserRuleHandler(parserRuleRepo)

	// ── Gin Engine ───────────────────────────────────────────
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(gin.Logger())
	r.Use(middleware.CORS(cfg.AppURL))

	// ── Routes ───────────────────────────────────────────────
	httpdelivery.RegisterRoutes(r, &httpdelivery.Dependencies{
		HealthHandler:           healthHandler,
		AuthHandler:             authHandler,
		UsersHandler:            usersHandler,
		AccountsHandler:         accountsHandler,
		TransactionsHandler:     transactionsHandler,
		CategoriesHandler:       categoriesHandler,
		BudgetsHandler:          budgetsHandler,
		DashboardHandler:        dashboardHandler,
		WorkspaceHandler:        workspaceHandler,
		SettingsHandler:         settingsHandler,
		EmailIntegrationHandler: emailIntegrationHandler,
		EmailMessageHandler:     emailMessageHandler,
		BankParserRuleHandler:   bankParserRuleHandler,
		JWTSecret:               cfg.JWTSecret,
		AppURL:                  cfg.AppURL,
		UserRepo:                userRepo,
	})

	// ── Background Workers ───────────────────────────────────
	// Workers start in the background — they don't block server startup.
	workerCtx := context.Background()

	imapWorker := worker.NewIMAPWorker(emailIntegrationRepo, emailMsgRepo, emailImportSvc)
	go imapWorker.Start(workerCtx)

	gmailWorker := worker.NewGmailWorker(
		emailIntegrationRepo, emailMsgRepo, emailImportSvc,
		cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleCallbackURL,
	)
	go gmailWorker.Start(workerCtx)

	log.Println("✅ Background email workers started")

	// ── Start Server ─────────────────────────────────────────
	addr := fmt.Sprintf("0.0.0.0:%s", cfg.Port)
	log.Printf("🚀 FinTrackr API (Go) running on port %s", cfg.Port)
	log.Printf("🌍 Environment: %s", cfg.AppEnv)
	log.Printf("❤️  Health: http://localhost:%s/api/health", cfg.Port)

	if err := r.Run(addr); err != nil {
		log.Fatalf("❌ Server failed to start: %v", err)
	}
}
