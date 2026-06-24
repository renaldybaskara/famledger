package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/fintrackr/api/internal/delivery/http/handler"
	"github.com/fintrackr/api/internal/delivery/http/middleware"
	httpdelivery "github.com/fintrackr/api/internal/delivery/http"
	"github.com/fintrackr/api/internal/infrastructure/config"
	"github.com/fintrackr/api/internal/infrastructure/database"
	aisvc    "github.com/fintrackr/api/internal/infrastructure/ai"
	emailsvc "github.com/fintrackr/api/internal/infrastructure/email"
	ocrsvc   "github.com/fintrackr/api/internal/infrastructure/ocr"
	"github.com/fintrackr/api/internal/infrastructure/payment"
	"github.com/fintrackr/api/internal/infrastructure/tokenstore"
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
	subscriptionRepo     := repository.NewSubscriptionRepository(db)
	accountRepo          := repository.NewAccountRepository(db)
	categoryRepo         := repository.NewCategoryRepository(db)
	transactionRepo      := repository.NewTransactionRepository(db)
	budgetRepo           := repository.NewBudgetRepository(db)
	workspaceRepo        := repository.NewWorkspaceRepository(db)
	emailIntegrationRepo := repository.NewEmailIntegrationRepository(db)
	settingRepo          := repository.NewSystemSettingRepository(db)
	emailMsgRepo         := repository.NewEmailMessageRepository(db)
	parserRuleRepo       := repository.NewBankParserRuleRepository(db)

	// ── AI Service (OpenRouter — optional, for ambiguous email parsing) ──────────
	aiService := aisvc.New(cfg.OpenRouterAPIKey, cfg.OpenRouterModel)
	if aiService.Enabled() {
		log.Printf("✅ OpenRouter AI enabled (model: %s)", cfg.OpenRouterModel)
	} else {
		log.Println("ℹ️  OpenRouter AI disabled — set OPENROUTER_API_KEY to enable")
	}

	// ── Midtrans (web payment gateway) ───────────────────────────────────────────
	midtransSvc := payment.NewMidtransService(cfg.MidtransServerKey, cfg.MidtransClientKey, cfg.MidtransMerchantID, cfg.MidtransIsProduction)
	if midtransSvc.Enabled() {
		log.Println("✅ Midtrans payment gateway enabled")
	} else {
		log.Println("ℹ️  Midtrans disabled — set MIDTRANS_SERVER_KEY to enable")
	}

	// ── OCR Service (PaddleOCR Python microservice) ──────────────────────────────
	ocrClient := ocrsvc.NewClient(cfg.OCRServiceURL)
	log.Printf("ℹ️  OCR service URL: %s", cfg.OCRServiceURL)

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
	workspaceUC         := usecase.NewWorkspaceUseCase(workspaceRepo, userRepo, transactionRepo, emailService)
	settingsUC          := usecase.NewSettingsUseCase(settingRepo, emailService, cfg)
	subscriptionUC      := usecase.NewSubscriptionUseCase(subscriptionRepo, userRepo, midtransSvc, cfg.DisableTierLimits)
	// Inject subscription UC so Register/GoogleLogin can start a 14-day trial.
	if as, ok := authUC.(usecase.AuthWithSubscription); ok {
		as.WithSubscriptionUC(subscriptionUC)
	}
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
		aiService,
	)

	// ── Token store (Redis) — secure OAuth token exchange, tokens never in URLs ──
	var ts *tokenstore.Store
	if cfg.RedisURL != "" {
		var err error
		ts, err = tokenstore.New(cfg.RedisURL)
		if err != nil {
			log.Printf("⚠️  TokenStore unavailable (Redis): %v — falling back to fragment", err)
		} else {
			log.Println("✅ TokenStore (Redis) ready")
		}
	}

	// ── Handlers ─────────────────────────────────────────────
	healthHandler           := handler.NewHealthHandler("1.0.0", cfg.AppEnv)
	authHandler             := handler.NewAuthHandler(authUC, cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleCallbackURL, ts)
	usersHandler            := handler.NewUsersHandler(userUC)
	accountsHandler         := handler.NewAccountsHandler(accountUC)
	categoriesHandler       := handler.NewCategoriesHandler(categoryUC)
	transactionsHandler     := handler.NewTransactionsHandler(transactionUC)
	budgetsHandler          := handler.NewBudgetsHandler(budgetUC)
	dashboardHandler        := handler.NewDashboardHandler(transactionUC, workspaceUC)
	workspaceHandler        := handler.NewWorkspaceHandler(workspaceUC)
	settingsHandler         := handler.NewSettingsHandler(settingsUC)
	emailIntegrationHandler := handler.NewEmailIntegrationHandler(emailIntegrationUC)
	emailMessageHandler     := handler.NewEmailMessageHandler(emailMsgRepo, emailImportSvc)
	bankParserRuleHandler   := handler.NewBankParserRuleHandler(parserRuleRepo)
	paymentSlipUC           := usecase.NewPaymentSlipUseCase(ocrClient)
	paymentSlipHandler      := handler.NewPaymentSlipHandler(paymentSlipUC)
	subscriptionHandler     := handler.NewSubscriptionHandler(subscriptionUC, cfg.RevenueCatWebhookSecret)

	// ── Gin Engine ───────────────────────────────────────────
	r := gin.New()
	// Trust all proxies — safe behind Caddy/ngrok in a private Docker network.
	r.SetTrustedProxies(nil)
	r.Use(gin.Recovery())
	r.Use(gin.Logger())
	r.Use(middleware.ForwardedProto())
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
		PaymentSlipHandler:      paymentSlipHandler,
		SubscriptionHandler:     subscriptionHandler,
		JWTSecret:               cfg.JWTSecret,
		AppURL:                  cfg.AppURL,
		UserRepo:                userRepo,
		SubscriptionUC:          subscriptionUC,
	})

	// ── Background Workers ───────────────────────────────────
	// Workers start in the background — they don't block server startup.
	workerCtx := context.Background()

	imapWorker := worker.NewIMAPWorker(emailIntegrationRepo, emailMsgRepo, emailImportSvc, subscriptionUC)
	go imapWorker.Start(workerCtx)

	gmailWorker := worker.NewGmailWorker(
		emailIntegrationRepo, emailMsgRepo, emailImportSvc, subscriptionUC,
		cfg.GoogleClientID, cfg.GoogleClientSecret, gmailCallbackURL,
	)
	go gmailWorker.Start(workerCtx)

	// Purge expired refresh tokens once a day to prevent unbounded table growth.
	// Revoked tokens are kept until their natural expiry so token-reuse detection still works.
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-workerCtx.Done():
				return
			case <-ticker.C:
				n, err := rtRepo.DeleteExpired(workerCtx)
				if err != nil {
					log.Printf("⚠️  refresh token cleanup: %v", err)
				} else if n > 0 {
					log.Printf("🗑️  deleted %d expired refresh token(s)", n)
				}
			}
		}
	}()

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
