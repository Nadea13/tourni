package main

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/helmet"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	fiberLogger "github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"tourni-backend/internal/config"
	"tourni-backend/internal/database"
	"tourni-backend/internal/handler"
	appLogger "tourni-backend/internal/logger"
	"tourni-backend/internal/middleware"
	"tourni-backend/internal/repository"
	"tourni-backend/internal/service"
	wsHub "tourni-backend/internal/websocket"
)

func main() {
	cfg := config.LoadConfig()

	// 1. Initialize Database
	dbPool, err := database.ConnectPostgres(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf(" PostgreSQL Connection Error: %v", err)
	}
	defer dbPool.Close()

	// 1.1 Run Database Migrations Automatically
	if err := database.RunMigrations(dbPool); err != nil {
		log.Printf("⚠️ Auto-migration error: %v", err)
	}

	// 1.2 Start Automated Soft-Deleted Records Purge Worker (every 24 hours)
	database.StartPurgeWorker(dbPool, 24*time.Hour)

	// 2. Initialize Redis
	redisClient := database.ConnectRedis(cfg.RedisURL)
	defer redisClient.Close()

	// 3. Initialize WebSocket Hub
	hub := wsHub.NewHub()
	go hub.Run()

	// 4. Initialize Repositories
	userRepo := repository.NewUserRepository(dbPool)
	tournamentRepo := repository.NewTournamentRepository(dbPool)
	matchRepo := repository.NewMatchRepository(dbPool)
	standingsRepo := repository.NewStandingsRepository(dbPool)
	teamRepo := repository.NewTeamRepository(dbPool)
	masterPlayerRepo := repository.NewMasterPlayerRepository(dbPool)
	registrationRepo := repository.NewRegistrationRepository(dbPool)
	extraRepo := repository.NewExtraRepository(dbPool)
	teamManagementRepo := repository.NewTeamManagementRepository(dbPool)

	// 5. Initialize Services
	mailService := service.NewMailService(redisClient, cfg)
	authService := service.NewAuthService(userRepo, redisClient, cfg)
	tournamentService := service.NewTournamentService(tournamentRepo)
	matchService := service.NewMatchService(matchRepo, hub, standingsRepo)
	standingsService := service.NewStandingsService(standingsRepo, matchRepo)
	teamService := service.NewTeamService(teamRepo, masterPlayerRepo)
	masterPlayerService := service.NewMasterPlayerService(masterPlayerRepo)
	registrationService := service.NewRegistrationService(registrationRepo, masterPlayerRepo)
	extraService := service.NewExtraService(extraRepo)

	// 6. Initialize Handlers
	authHandler := handler.NewAuthHandler(authService, mailService, userRepo, cfg)
	tournamentHandler := handler.NewTournamentHandler(tournamentService)
	matchHandler := handler.NewMatchHandler(matchService)
	standingsHandler := handler.NewStandingsHandler(standingsService)
	teamHandler := handler.NewTeamHandler(teamService)
	masterPlayerHandler := handler.NewMasterPlayerHandler(masterPlayerService)
	registrationHandler := handler.NewRegistrationHandler(registrationService)
	extraHandler := handler.NewExtraHandler(extraService)
	teamManagementHandler := handler.NewTeamManagementHandler(teamManagementRepo)

	// 7. Initialize Grafana Loki Centralized Logger (0฿ Free Tier)
	lokiClient := appLogger.InitLoki(cfg.LokiURL, cfg.LokiUser, cfg.LokiToken)

	// 8. Initialize Fiber App with expanded buffer sizes
	app := fiber.New(fiber.Config{
		AppName:         "Tourni API v1",
		ReadBufferSize:  16 * 1024, // 16KB to prevent 431 Request Header Fields Too Large from browser cookies
		WriteBufferSize: 16 * 1024,
	})

	app.Use(recover.New())
	app.Use(helmet.New())
	app.Use(fiberLogger.New())
	if lokiClient != nil {
		app.Use(appLogger.FiberMiddleware(lokiClient))
	}
	app.Use(cors.New(cors.Config{
		AllowOrigins: cfg.CORSOrigins,
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))

	// Cloudflare & Reverse Proxy Aware Client IP Resolver
	getClientIP := func(c *fiber.Ctx) string {
		if cfIP := c.Get("CF-Connecting-IP"); cfIP != "" {
			return cfIP
		}
		if xff := c.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			return strings.TrimSpace(parts[0])
		}
		return c.IP()
	}

	// 1. General API Rate Limiter (Default: 600 req/min per IP, bypass on localhost for development)
	generalLimiter := limiter.New(limiter.Config{
		Max:        cfg.RateLimitGeneralMax,
		Expiration: 1 * time.Minute,
		KeyGenerator: getClientIP,
		Next: func(c *fiber.Ctx) bool {
			ip := getClientIP(c)
			return ip == "127.0.0.1" || ip == "::1" || ip == "localhost"
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Too many requests. Please slow down.",
			})
		},
	})
	app.Use(generalLimiter)

	// 2. Strict Auth Rate Limiter for Brute-Force & OTP spam prevention (Default: 30 req/min)
	authLimiter := limiter.New(limiter.Config{
		Max:        cfg.RateLimitAuthMax,
		Expiration: 1 * time.Minute,
		KeyGenerator: getClientIP,
		Next: func(c *fiber.Ctx) bool {
			ip := getClientIP(c)
			return ip == "127.0.0.1" || ip == "::1" || ip == "localhost"
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Too many authentication attempts. Please wait 1 minute before trying again.",
			})
		},
	})

	// 3. Edge Caching Helper (Instructs Cloudflare Edge & Browser to cache public GET responses)
	edgeCache := func(maxAgeSeconds int) fiber.Handler {
		return func(c *fiber.Ctx) error {
			c.Set("Cache-Control", fmt.Sprintf("public, max-age=%d, s-maxage=%d, stale-while-revalidate=%d", maxAgeSeconds, maxAgeSeconds*2, maxAgeSeconds*4))
			return c.Next()
		}
	}

	// Health check route (unlimited)
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"message": "Tourni API is healthy and running",
		})
	})

	// API Routes Group
	api := app.Group("/api/v1")
	api.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"version": "1.0.0",
			"name":    "Tourni Core API",
		})
	})

	// Auth routes (Email OTP & Login/Register/ResetPassword & Google OAuth)
	auth := api.Group("/auth")
	auth.Post("/send-otp", authLimiter, authHandler.SendOTP)
	auth.Post("/verify-otp", authLimiter, authHandler.VerifyOTP)
	auth.Post("/reset-password", authLimiter, authHandler.ResetPassword)
	auth.Post("/register", authLimiter, authHandler.Register)
	auth.Post("/login", authLimiter, authHandler.Login)
	auth.Post("/refresh", authLimiter, authHandler.Refresh)
	auth.Get("/google", authHandler.GoogleLogin)
	auth.Get("/google/callback", authHandler.GoogleCallback)
	auth.Get("/me", middleware.Protected(cfg), authHandler.Me)
	auth.Put("/me", middleware.Protected(cfg), authHandler.UpdateProfile)
	auth.Patch("/me", middleware.Protected(cfg), authHandler.UpdateProfile)
	auth.Post("/change-password", middleware.Protected(cfg), authHandler.ChangePassword)

	// Sports & Age Categories (Edge Cached for 60 seconds)
	api.Get("/sports", edgeCache(60), extraHandler.ListSports)
	api.Get("/age-categories", edgeCache(60), extraHandler.ListAgeCategories)
	api.Post("/age-categories", extraHandler.CreateAgeCategory)

	// Teams routes
	teams := api.Group("/teams")
	teams.Get("/", teamHandler.List)
	teams.Get("/search-claim", teamManagementHandler.SearchTeams)
	teams.Get("/:id", teamHandler.GetByID)
	teams.Post("/", middleware.Protected(cfg), teamHandler.Create)
	teams.Put("/:id", middleware.Protected(cfg), teamHandler.Update)
	teams.Delete("/:id", middleware.Protected(cfg), teamHandler.Delete)
	teams.Get("/:id/players", teamHandler.GetPlayers)
	teams.Post("/:id/players", middleware.Protected(cfg), teamHandler.AddPlayer)
	teams.Put("/:id/players/:playerId", middleware.Protected(cfg), teamHandler.UpdatePlayer)
	teams.Delete("/:id/players/:playerId", middleware.Protected(cfg), teamHandler.DeletePlayer)
	teams.Post("/:id/reset-roster", middleware.Protected(cfg), teamHandler.ResetRoster)
	teams.Post("/:id/restore-roster", middleware.Protected(cfg), teamHandler.RestoreRoster)
	teams.Patch("/:id/lock", middleware.Protected(cfg), teamHandler.LockRoster)
	teams.Put("/:id/lock", middleware.Protected(cfg), teamHandler.LockRoster)
	teams.Post("/:id/lock", middleware.Protected(cfg), teamHandler.LockRoster)
	teams.Get("/:id/has-deleted-players", teamHandler.HasSoftDeletedPlayers)

	// Team Management Requests
	teamRequests := api.Group("/team-management-requests")
	teamRequests.Post("/", middleware.Protected(cfg), teamManagementHandler.SubmitRequest)
	teamRequests.Get("/my", middleware.Protected(cfg), teamManagementHandler.ListMyRequests)
	teamRequests.Get("/incoming", middleware.Protected(cfg), teamManagementHandler.ListIncomingRequests)
	teamRequests.Post("/:id/approve", middleware.Protected(cfg), teamManagementHandler.ApproveRequest)
	teamRequests.Post("/:id/reject", middleware.Protected(cfg), teamManagementHandler.RejectRequest)

	// Master Players routes
	masterPlayers := api.Group("/master-players")
	masterPlayers.Get("/", masterPlayerHandler.List)
	masterPlayers.Get("/:id", masterPlayerHandler.GetByID)
	masterPlayers.Post("/", middleware.Protected(cfg), masterPlayerHandler.Create)
	masterPlayers.Put("/:id", middleware.Protected(cfg), masterPlayerHandler.Update)
	masterPlayers.Delete("/:id", middleware.Protected(cfg), masterPlayerHandler.Delete)

	// Tournament routes
	tournaments := api.Group("/tournaments")
	tournaments.Get("/", edgeCache(15), tournamentHandler.List)
	tournaments.Get("/status-requests/my", middleware.Protected(cfg), tournamentHandler.ListMyStatusRequests)
	tournaments.Get("/:id", edgeCache(15), tournamentHandler.GetByID)
	tournaments.Post("/", middleware.Protected(cfg), tournamentHandler.Create)
	tournaments.Put("/:id", middleware.Protected(cfg), tournamentHandler.Update)
	tournaments.Patch("/:id/status", tournamentHandler.UpdateStatus)
	tournaments.Put("/:id/status", tournamentHandler.UpdateStatus)
	tournaments.Delete("/:id", middleware.Protected(cfg), tournamentHandler.Delete)
	tournaments.Post("/:id/status-request", middleware.Protected(cfg), tournamentHandler.RequestStatusChange)
	tournaments.Delete("/:id/status-request", middleware.Protected(cfg), tournamentHandler.CancelStatusRequest)
	tournaments.Get("/:id/status-request", tournamentHandler.GetStatusRequest)

	// Users routes
	api.Get("/users", authHandler.ListUsers)
	api.Put("/users/:id", authHandler.UpdateUser)

	// Admin routes
	api.Get("/admin/table-counts", extraHandler.GetTableCounts)
	api.Get("/admin/table-preview", extraHandler.GetTablePreview)
	admin := api.Group("/admin", middleware.Protected(cfg))
	admin.Get("/table-counts", extraHandler.GetTableCounts)
	admin.Get("/table-preview", extraHandler.GetTablePreview)
	admin.Get("/tournament-status-requests", tournamentHandler.ListAdminStatusRequests)
	admin.Post("/tournaments/:id/status-request/approve", tournamentHandler.ApproveStatusRequest)
	admin.Post("/tournaments/:id/status-request/reject", tournamentHandler.RejectStatusRequest)


	// Tournament Categories
	tournaments.Get("/:id/categories", edgeCache(15), tournamentHandler.GetCategories)
	tournaments.Post("/:id/categories", middleware.Protected(cfg), tournamentHandler.CreateCategory)
	tournaments.Put("/:id/categories/:categoryId", tournamentHandler.UpdateCategory)
	tournaments.Patch("/:id/categories/:categoryId", tournamentHandler.UpdateCategory)
	tournaments.Patch("/:id/categories/:categoryId/canvas", tournamentHandler.UpdateCategoryCanvas)
	tournaments.Put("/:id/categories/:categoryId/canvas", tournamentHandler.UpdateCategoryCanvas)
	tournaments.Delete("/:id/categories/:categoryId", middleware.Protected(cfg), tournamentHandler.DeleteCategory)
	tournaments.Get("/:id/categories/:categoryId/standings", edgeCache(15), standingsHandler.GetByCategory)
	tournaments.Post("/:id/categories/:categoryId/standings/recalculate", standingsHandler.Recalculate)
	tournaments.Get("/:id/categories/:categoryId/matches", edgeCache(10), matchHandler.GetByCategory)
	tournaments.Post("/:id/categories/:categoryId/sync-matches", matchHandler.SyncCategoryMatches)
	tournaments.Delete("/:id/categories/:categoryId/matches", matchHandler.DeleteByCategory)

	// Tournament Matches & Events
	tournaments.Get("/:id/matches", edgeCache(10), matchHandler.GetByTournament)
	tournaments.Get("/:id/events", edgeCache(10), matchHandler.GetEventsByTournament)

	// Tournament Registrations & Teams
	tournaments.Get("/actions/incoming", middleware.Protected(cfg), registrationHandler.ListIncomingTournamentActions)
	api.Get("/registrations/my", middleware.Protected(cfg), registrationHandler.ListMyRegistrations)
	tournaments.Get("/:id/teams", registrationHandler.ListTournamentTeams)
	tournaments.Post("/:id/teams", registrationHandler.RegisterTeam)
	tournaments.Get("/:id/registrations", registrationHandler.ListTournamentTeams)
	tournaments.Post("/:id/registrations", registrationHandler.RegisterTeam)
	tournaments.Get("/:id/registrations/:regId", registrationHandler.GetTournamentTeam)
	tournaments.Patch("/:id/registrations/:regId/status", registrationHandler.UpdateStatus)
	tournaments.Post("/:id/registrations/:regId/request-unlock", registrationHandler.RequestUnlock)
	tournaments.Post("/:id/registrations/:regId/approve-unlock", registrationHandler.ApproveUnlock)
	tournaments.Post("/:id/registrations/:regId/reject-unlock", registrationHandler.RejectUnlock)
	tournaments.Patch("/:id/registrations/:regId/lock", registrationHandler.LockRoster)

	// Tournament Roster Submissions
	tournaments.Get("/:id/registrations/:regId/roster", registrationHandler.GetRoster)
	tournaments.Post("/:id/registrations/:regId/roster", registrationHandler.AddRosterSubmission)
	tournaments.Delete("/:id/registrations/:regId/roster/:subId", registrationHandler.DeleteRosterSubmission)
	tournaments.Post("/:id/registrations/:regId/approve-roster", registrationHandler.ApproveRoster)
	tournaments.Post("/:id/registrations/:regId/reject-roster", registrationHandler.RejectRoster)
	tournaments.Post("/:id/registrations/:regId/roster/:subId/approve", registrationHandler.ApproveRosterSubmission)
	tournaments.Post("/:id/registrations/:regId/roster/:subId/reject", registrationHandler.RejectRosterSubmission)
	tournaments.Post("/:id/registrations/:regId/roster/batch-approve", registrationHandler.BatchApproveRosterSubmissions)

	// Tournament Players (tournament_players table)
	tournaments.Get("/:id/players", registrationHandler.GetPlayersByTournament)
	tournaments.Get("/:id/registrations/:regId/players", registrationHandler.GetTournamentPlayers)
	tournaments.Post("/:id/registrations/:regId/players", registrationHandler.AddTournamentPlayer)
	tournaments.Put("/:id/registrations/:regId/players/:playerId", registrationHandler.UpdateTournamentPlayer)
	tournaments.Delete("/:id/registrations/:regId/players/:playerId", registrationHandler.DeleteTournamentPlayer)

	tournaments.Get("/:id/teams/:teamId/players", registrationHandler.GetTournamentPlayers)
	tournaments.Post("/:id/teams/:teamId/players", registrationHandler.AddTournamentPlayer)
	tournaments.Put("/:id/teams/:teamId/players/:playerId", registrationHandler.UpdateTournamentPlayer)
	tournaments.Delete("/:id/teams/:teamId/players/:playerId", registrationHandler.DeleteTournamentPlayer)

	api.Get("/tournament-teams/:id", registrationHandler.GetTournamentTeam)
	api.Post("/tournament-teams/:id/withdraw", registrationHandler.WithdrawTournamentTeam)
	api.Delete("/tournament-teams/:id", registrationHandler.WithdrawTournamentTeam)
	tournaments.Post("/:id/registrations/:regId/withdraw", registrationHandler.WithdrawTournamentTeam)
	tournaments.Delete("/:id/registrations/:regId", registrationHandler.WithdrawTournamentTeam)
	api.Get("/tournament-teams/:id/roster", registrationHandler.GetRoster)
	api.Post("/tournament-teams/:id/approve-roster", registrationHandler.ApproveRoster)
	api.Post("/tournament-teams/:id/reject-roster", registrationHandler.RejectRoster)
	api.Post("/tournament-teams/:id/reject-unlock", registrationHandler.RejectUnlock)
	api.Post("/tournament-teams/:id/roster/batch-approve", registrationHandler.BatchApproveRosterSubmissions)
	api.Post("/tournament-roster-submissions/:subId/approve", registrationHandler.ApproveRosterSubmission)
	api.Post("/tournament-roster-submissions/:subId/reject", registrationHandler.RejectRosterSubmission)
	api.Get("/tournament-teams/:regId/players", registrationHandler.GetTournamentPlayers)
	api.Post("/tournament-teams/:regId/players", registrationHandler.AddTournamentPlayer)
	api.Put("/tournament-teams/:regId/players/:playerId", registrationHandler.UpdateTournamentPlayer)
	api.Delete("/tournament-teams/:regId/players/:playerId", registrationHandler.DeleteTournamentPlayer)

	// Tournament Sponsors
	tournaments.Get("/:id/sponsors", extraHandler.ListSponsors)
	tournaments.Post("/:id/sponsors", middleware.Protected(cfg), extraHandler.CreateSponsor)
	tournaments.Put("/:id/sponsors/:sponsorId", middleware.Protected(cfg), extraHandler.UpdateSponsor)
	tournaments.Patch("/:id/sponsors/:sponsorId", middleware.Protected(cfg), extraHandler.UpdateSponsor)
	tournaments.Delete("/:id/sponsors/:sponsorId", middleware.Protected(cfg), extraHandler.DeleteSponsor)

	// Tournament Announcements
	tournaments.Get("/:id/announcements", extraHandler.ListAnnouncements)
	tournaments.Post("/:id/announcements", middleware.Protected(cfg), extraHandler.CreateAnnouncement)
	tournaments.Put("/:id/announcements/:announcementId", middleware.Protected(cfg), extraHandler.UpdateAnnouncement)
	tournaments.Patch("/:id/announcements/:announcementId", middleware.Protected(cfg), extraHandler.UpdateAnnouncement)
	tournaments.Delete("/:id/announcements/:announcementId", middleware.Protected(cfg), extraHandler.DeleteAnnouncement)

	// Tournament Staff / Invitations
	tournaments.Get("/:id/invitations", extraHandler.ListInvitations)
	tournaments.Post("/:id/invitations", middleware.Protected(cfg), extraHandler.CreateInvitation)
	tournaments.Put("/:id/invitations/:invitationId", middleware.Protected(cfg), extraHandler.UpdateInvitation)
	tournaments.Patch("/:id/invitations/:invitationId", middleware.Protected(cfg), extraHandler.UpdateInvitation)
	tournaments.Delete("/:id/invitations/:invitationId", middleware.Protected(cfg), extraHandler.DeleteInvitation)

	// User Invitations
	invitations := api.Group("/invitations")
	invitations.Get("/my", middleware.Protected(cfg), extraHandler.ListMyInvitations)
	invitations.Post("/:tournamentId/accept", middleware.Protected(cfg), extraHandler.AcceptInvitation)
	invitations.Post("/:tournamentId/reject", middleware.Protected(cfg), extraHandler.RejectInvitation)

	// Matches direct routes
	matches := api.Group("/matches")
	matches.Get("/:id", matchHandler.GetByID)
	matches.Post("/", middleware.OptionalAuth(cfg), matchHandler.Create)
	matches.Put("/:id", middleware.OptionalAuth(cfg), matchHandler.Update)
	matches.Delete("/:id", middleware.OptionalAuth(cfg), matchHandler.Delete)
	matches.Patch("/:id/score", matchHandler.UpdateScore)
	matches.Get("/:id/events", matchHandler.ListEvents)
	matches.Post("/:id/events", middleware.OptionalAuth(cfg), matchHandler.AddEvent)
	matches.Delete("/:id/events/:eventId", middleware.OptionalAuth(cfg), matchHandler.DeleteEvent)

	// Payments routes
	payments := api.Group("/payments")
	payments.Get("/", extraHandler.ListPayments)
	payments.Post("/", extraHandler.CreatePayment)

	// WebSocket Live Score routes
	app.Use("/ws", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			c.Locals("allowed", true)
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})

	app.Get("/ws/matches/:id", websocket.New(func(c *websocket.Conn) {
		matchID := c.Params("id")
		client := &wsHub.Client{
			Hub:     hub,
			Conn:    c,
			Send:    make(chan []byte, 256),
			MatchID: matchID,
		}
		hub.Register(client)

		go client.WritePump()
		client.ReadPump()
	}))

	log.Printf("🚀 Server running on port %s", cfg.Port)
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("Server shutdown error: %v", err)
	}
}
