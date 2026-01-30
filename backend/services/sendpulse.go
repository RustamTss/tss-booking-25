package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

type SendPulseService struct {
	clientID     string
	clientSecret string

	mu        sync.Mutex
	token     string
	expiresAt time.Time

	http *http.Client
}

func NewSendPulseService(clientID, clientSecret string) *SendPulseService {
	return &SendPulseService{
		clientID:     clientID,
		clientSecret: clientSecret,
		http:         &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *SendPulseService) ensureToken(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// still valid for > 2 minutes?
	if s.token != "" && time.Until(s.expiresAt) > 2*time.Minute {
		return nil
	}
	if s.clientID == "" || s.clientSecret == "" {
		return fmt.Errorf("sendpulse credentials missing")
	}

	body, _ := json.Marshal(map[string]string{
		"grant_type":    "client_credentials",
		"client_id":     s.clientID,
		"client_secret": s.clientSecret,
	})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.sendpulse.com/oauth/access_token", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	res, err := s.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("sendpulse auth status %d", res.StatusCode)
	}
	var out struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return err
	}
	s.token = out.AccessToken
	s.expiresAt = time.Now().Add(time.Duration(out.ExpiresIn) * time.Second)
	return nil
}

// StartAutoRefresh primes and refreshes token periodically.
func (s *SendPulseService) StartAutoRefresh(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	go func() {
		defer t.Stop()
		_ = s.ensureToken(ctx) // prime
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				_ = s.ensureToken(ctx)
			}
		}
	}()
}

// SendHTML sends an HTML text message to a Telegram contact via SendPulse.
func (s *SendPulseService) SendHTML(ctx context.Context, contactID, html string) error {
	if err := s.ensureToken(ctx); err != nil {
		return err
	}
	payload := map[string]interface{}{
		"contact_id": contactID,
		"message": map[string]string{
			"type":       "text",
			"text":       html,
			"parse_mode": "html",
		},
	}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.sendpulse.com/telegram/contacts/send", bytes.NewBuffer(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	res, err := s.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("sendpulse send status %d", res.StatusCode)
	}
	return nil
}

