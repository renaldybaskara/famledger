package config

import (
	"os"
	"strconv"
)

type Config struct {
	DatabaseURL         string
	JWTSecret           string
	JWTRefreshSecret    string
	JWTExpiresIn        string
	JWTRefreshExpiresIn string
	GoogleClientID             string
	GoogleClientSecret         string
	GoogleCallbackURL          string
	GoogleGmailCallbackURL     string
	RedisURL            string
	AppURL              string
	Port                string
	AppEnv              string
	// SMTP / Email
	SMTPHost string
	SMTPPort string
	SMTPUser string
	SMTPPass string
	// Rate limiting
	RateLimitRequests int
	RateLimitWindow   int // seconds
}

func Load() *Config {
	rateLimitRequests, _ := strconv.Atoi(getEnv("RATE_LIMIT_REQUESTS", "100"))
	rateLimitWindow, _ := strconv.Atoi(getEnv("RATE_LIMIT_WINDOW", "60"))

	return &Config{
		DatabaseURL:         mustGetEnv("DATABASE_URL"),
		JWTSecret:           mustGetEnv("JWT_SECRET"),
		JWTRefreshSecret:    mustGetEnv("JWT_REFRESH_SECRET"),
		JWTExpiresIn:        getEnv("JWT_EXPIRES_IN", "15m"),
		JWTRefreshExpiresIn: getEnv("JWT_REFRESH_EXPIRES_IN", "30d"),
		GoogleClientID:         getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret:     getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleCallbackURL:      getEnv("GOOGLE_CALLBACK_URL", ""),
		GoogleGmailCallbackURL: getEnv("GOOGLE_GMAIL_CALLBACK_URL", ""),
		RedisURL:            getEnv("REDIS_URL", ""),
		AppURL:              getEnv("APP_URL", "http://localhost"),
		Port:                getEnv("PORT", "4000"),
		AppEnv:              getEnv("NODE_ENV", "production"),
		SMTPHost:            getEnv("SMTP_HOST", ""),
		SMTPPort:            getEnv("SMTP_PORT", "587"),
		SMTPUser:            getEnv("SMTP_USER", ""),
		SMTPPass:            getEnv("SMTP_PASS", ""),
		RateLimitRequests:   rateLimitRequests,
		RateLimitWindow:     rateLimitWindow,
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func mustGetEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic("required environment variable not set: " + key)
	}
	return v
}
