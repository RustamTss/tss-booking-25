package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type TelegramService struct {
	token  string
	chat   string
	client *http.Client
}

type telegramMessage struct {
	ChatID string `json:"chat_id"`
	Text   string `json:"text"`
}

func NewTelegramService(token, chat string) *TelegramService {
	return &TelegramService{
		token:  token,
		chat:   chat,
		client: &http.Client{Timeout: 5 * time.Second},
	}
}

// Notify отправляет сообщение, если токен и chat заданы.
func (s *TelegramService) Notify(text string) error {
	if s.token == "" || s.chat == "" {
		return nil
	}

	payload := telegramMessage{ChatID: s.chat, Text: text}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", s.token)

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("telegram send status %d", resp.StatusCode)
	}
	return nil
}

func (s *TelegramService) Update(token, chat string) {
	s.token = token
	s.chat = chat
}
