// Package tokenstore provides a short-lived token exchange store backed by Redis.
// After Google OAuth, instead of putting JWT tokens in the URL, we store them in
// Redis under a random one-time code. The browser only receives the short code in
// the URL, then exchanges it immediately via a POST — tokens never appear in logs.
package tokenstore

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const codeTTL = 2 * time.Minute // code expires after 2 minutes

// TokenPair holds the JWT pair stored temporarily in Redis.
type TokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

// Store wraps a Redis client for one-time token exchange.
type Store struct {
	rdb *redis.Client
}

// New creates a Store connected to the given Redis URL.
func New(redisURL string) (*Store, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("tokenstore: parse redis URL: %w", err)
	}
	rdb := redis.NewClient(opts)
	// Ping to verify connectivity
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("tokenstore: redis ping: %w", err)
	}
	return &Store{rdb: rdb}, nil
}

// Save stores the token pair and returns a random one-time code.
func (s *Store) Save(ctx context.Context, pair TokenPair) (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	code := hex.EncodeToString(b)

	data, err := json.Marshal(pair)
	if err != nil {
		return "", err
	}

	key := "auth:code:" + code
	if err := s.rdb.Set(ctx, key, data, codeTTL).Err(); err != nil {
		return "", fmt.Errorf("tokenstore: save: %w", err)
	}
	return code, nil
}

// Exchange retrieves and deletes the token pair for a given code (one-time use).
func (s *Store) Exchange(ctx context.Context, code string) (*TokenPair, error) {
	key := "auth:code:" + code
	data, err := s.rdb.GetDel(ctx, key).Bytes()
	if err != nil {
		if err == redis.Nil {
			return nil, fmt.Errorf("invalid or expired code")
		}
		return nil, fmt.Errorf("tokenstore: exchange: %w", err)
	}
	var pair TokenPair
	if err := json.Unmarshal(data, &pair); err != nil {
		return nil, err
	}
	return &pair, nil
}
