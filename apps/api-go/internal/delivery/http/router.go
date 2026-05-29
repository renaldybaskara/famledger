package http

import (
	"github.com/fintrackr/api/internal/delivery/http/handler"
	"github.com/fintrackr/api/internal/delivery/http/middleware"
	"github.com/fintrackr/api/internal/domain/repository"
	"github.com/gin-gonic/gin"
)

type Dependencies struct {
	HealthHandler           *handler.HealthHandler
	AuthHandler             *handler.AuthHandler
	UsersHandler            *handler.UsersHandler
	AccountsHandler         *handler.AccountsHandler
	TransactionsHandler     *handler.TransactionsHandler
	CategoriesHandler       *handler.CategoriesHandler
	BudgetsHandler          *handler.BudgetsHandler
	DashboardHandler        *handler.DashboardHandler
	WorkspaceHandler        *handler.WorkspaceHandler
	EmailIntegrationHandler *handler.EmailIntegrationHandler
	EmailMessageHandler     *handler.EmailMessageHandler
	SettingsHandler         *handler.SettingsHandler
	BankParserRuleHandler   *handler.BankParserRuleHandler

	JWTSecret  string
	AppURL     string
	UserRepo   repository.UserRepository
}

func RegisterRoutes(r *gin.Engine, deps *Dependencies) {
	// Inject appURL into every request context for redirect handlers
	appURL := deps.AppURL
	if appURL == "" {
		appURL = "http://localhost"
	}
	r.Use(func(c *gin.Context) {
		c.Set("appURL", appURL)
		c.Next()
	})

	// Global prefix
	api := r.Group("/api")

	// Health — no auth
	api.GET("/health", deps.HealthHandler.Health)

	// Auth routes
	auth := api.Group("/auth")
	{
		auth.POST("/register", deps.AuthHandler.Register)
		auth.POST("/login", deps.AuthHandler.Login)
		auth.POST("/refresh", deps.AuthHandler.Refresh)
		auth.GET("/google", deps.AuthHandler.GoogleLogin)
		auth.GET("/google/callback", deps.AuthHandler.GoogleCallback)
		auth.GET("/google/configured", deps.AuthHandler.GoogleConfigured)
		auth.POST("/exchange", deps.AuthHandler.ExchangeCode)

		// Email verification (public — token-based)
		auth.POST("/verify-email", deps.AuthHandler.VerifyEmail)
		auth.GET("/verify-email", deps.AuthHandler.VerifyEmail)

		// Password reset (public)
		auth.POST("/forgot-password", deps.AuthHandler.ForgotPassword)
		auth.POST("/reset-password", deps.AuthHandler.ResetPassword)

		// Protected auth routes
		authProtected := auth.Group("")
		authProtected.Use(middleware.JWTAuth(deps.JWTSecret, deps.UserRepo))
		{
			authProtected.POST("/logout", deps.AuthHandler.Logout)
			authProtected.GET("/me", deps.AuthHandler.Me)
			authProtected.POST("/send-verification", deps.AuthHandler.SendVerification)
			authProtected.POST("/change-password", deps.AuthHandler.ChangePassword)
		}
	}

	// JWT-protected routes
	protected := api.Group("")
	protected.Use(middleware.JWTAuth(deps.JWTSecret, deps.UserRepo))

	// Users
	users := protected.Group("/users")
	{
		users.GET("/profile", deps.UsersHandler.GetProfile)
		users.PATCH("/profile", deps.UsersHandler.UpdateProfile)
	}

	// Accounts
	accounts := protected.Group("/accounts")
	{
		accounts.GET("", deps.AccountsHandler.FindAll)
		accounts.POST("", deps.AccountsHandler.Create)
		accounts.PATCH("/:id", deps.AccountsHandler.Update)
		accounts.DELETE("/:id", deps.AccountsHandler.Delete)
	}

	// Transactions
	transactions := protected.Group("/transactions")
	{
		transactions.GET("", deps.TransactionsHandler.FindAll)
		transactions.POST("", deps.TransactionsHandler.Create)
		transactions.GET("/:id", deps.TransactionsHandler.FindOne)
		transactions.PATCH("/:id", deps.TransactionsHandler.Update)
		transactions.DELETE("/:id", deps.TransactionsHandler.Delete)
	}

	// Categories
	categories := protected.Group("/categories")
	{
		categories.GET("", deps.CategoriesHandler.FindAll)
		categories.POST("", deps.CategoriesHandler.Create)
		categories.PATCH("/:id", deps.CategoriesHandler.Update)
		categories.DELETE("/:id", deps.CategoriesHandler.Delete)
	}

	// Budgets
	budgets := protected.Group("/budgets")
	{
		budgets.GET("", deps.BudgetsHandler.FindAll)
		budgets.POST("", deps.BudgetsHandler.Create)
		budgets.GET("/subscriptions", deps.BudgetsHandler.FindSubscriptions)
		budgets.PATCH("/:id", deps.BudgetsHandler.Update)
		budgets.DELETE("/:id", deps.BudgetsHandler.Delete)
	}

	// Dashboard
	dashboard := protected.Group("/dashboard")
	{
		dashboard.GET("/summary", deps.DashboardHandler.Summary)
		dashboard.GET("/category-breakdown", deps.DashboardHandler.CategoryBreakdown)
		dashboard.GET("/monthly-trend", deps.DashboardHandler.MonthlyTrend)
	}

	// Workspaces
	workspaces := protected.Group("/workspaces")
	{
		workspaces.GET("", deps.WorkspaceHandler.List)
		workspaces.POST("", deps.WorkspaceHandler.Create)
		workspaces.GET("/:id", deps.WorkspaceHandler.GetByID)
		workspaces.PATCH("/:id", deps.WorkspaceHandler.Update)
		workspaces.DELETE("/:id", deps.WorkspaceHandler.Delete)

		// Members
		workspaces.GET("/:id/members", deps.WorkspaceHandler.ListMembers)
		workspaces.PATCH("/:id/members/:userId", deps.WorkspaceHandler.UpdateMemberRole)
		workspaces.DELETE("/:id/members/:userId", deps.WorkspaceHandler.RemoveMember)
		workspaces.DELETE("/:id/leave", deps.WorkspaceHandler.Leave)

		// Invites
		workspaces.POST("/:id/invites", deps.WorkspaceHandler.InviteMember)
		workspaces.GET("/:id/invites", deps.WorkspaceHandler.ListInvites)
		workspaces.DELETE("/:id/invites/:inviteId", deps.WorkspaceHandler.RevokeInvite)

		// Accept/decline (token-based, still requires auth)
		workspaces.POST("/invites/accept", deps.WorkspaceHandler.AcceptInvite)
		workspaces.POST("/invites/decline", deps.WorkspaceHandler.DeclineInvite)

		// Activity log
		workspaces.GET("/:id/activity", deps.WorkspaceHandler.ListActivity)
	}

	// Settings (all authenticated users can read; all can save for self-hosted mode)
	settings := protected.Group("/settings")
	{
		settings.GET("/smtp", deps.SettingsHandler.GetSMTP)
		settings.PUT("/smtp", deps.SettingsHandler.SaveSMTP)
		settings.POST("/smtp/test", deps.SettingsHandler.TestSMTP)

		// Bank parser rules — admin-managed, global (affect all users)
		settings.GET("/parser-rules", deps.BankParserRuleHandler.List)
		settings.GET("/parser-rules/active", deps.BankParserRuleHandler.ListActive)
		settings.POST("/parser-rules", deps.BankParserRuleHandler.Create)
		settings.PATCH("/parser-rules/:id", deps.BankParserRuleHandler.Update)
		settings.PATCH("/parser-rules/:id/toggle", deps.BankParserRuleHandler.Toggle)
		settings.DELETE("/parser-rules/:id", deps.BankParserRuleHandler.Delete)
	}

	// Email Integrations — public routes (no JWT)
	// Must be registered on `api` group BEFORE protected group to avoid /:id matching
	api.GET("/email-integrations/gmail/callback", deps.EmailIntegrationHandler.GmailCallback)

	// Email Integrations — protected routes
	emailIntegrations := protected.Group("/email-integrations")
	{
		emailIntegrations.GET("", deps.EmailIntegrationHandler.List)
		emailIntegrations.POST("/imap", deps.EmailIntegrationHandler.ConnectIMAP)
		// /gmail/auth and /gmail/callback are static routes — must come before /:id
		emailIntegrations.GET("/gmail/auth", deps.EmailIntegrationHandler.GmailAuthURL)
		// /:id routes — these are dynamic and must come AFTER all static sub-paths
		emailIntegrations.DELETE("/:id", deps.EmailIntegrationHandler.Disconnect)
		emailIntegrations.PATCH("/:id/toggle", deps.EmailIntegrationHandler.Toggle)
		emailIntegrations.POST("/:id/sync", deps.EmailIntegrationHandler.Sync)
	}

	// Email Messages (parsed email inbox)
	emailMessages := protected.Group("/email-messages")
	{
		emailMessages.GET("", deps.EmailMessageHandler.List)
		emailMessages.GET("/:id", deps.EmailMessageHandler.GetOne)
		emailMessages.POST("/:id/reprocess", deps.EmailMessageHandler.Reprocess)
		emailMessages.DELETE("/:id", deps.EmailMessageHandler.Delete)
	}
}
