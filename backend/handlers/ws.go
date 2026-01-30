package handlers

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
)

type hub struct {
	mu        sync.RWMutex
	clients   map[*websocket.Conn]bool
	broadcast chan models.RealtimeEvent
}

var wsHub = hub{
	clients:   make(map[*websocket.Conn]bool),
	broadcast: make(chan models.RealtimeEvent, 32),
}

func init() {
	go func() {
		for msg := range wsHub.broadcast {
			payload, _ := json.Marshal(msg)
			var toRemove []*websocket.Conn
			// snapshot under read lock
			wsHub.mu.RLock()
			for c := range wsHub.clients {
				if err := c.WriteMessage(websocket.TextMessage, payload); err != nil {
					log.Println("ws write:", err)
					toRemove = append(toRemove, c)
				}
			}
			wsHub.mu.RUnlock()
			// remove broken connections under write lock
			if len(toRemove) > 0 {
				wsHub.mu.Lock()
				for _, c := range toRemove {
					c.Close()
					delete(wsHub.clients, c)
				}
				wsHub.mu.Unlock()
			}
		}
	}()
}

func (h *Handler) WSUpgrade(c *fiber.Ctx) error {
	if websocket.IsWebSocketUpgrade(c) {
		return c.Next()
	}
	return fiber.ErrUpgradeRequired
}

func (h *Handler) WSSocket(c *websocket.Conn) {
	wsHub.mu.Lock()
	wsHub.clients[c] = true
	wsHub.mu.Unlock()
	defer func() {
		wsHub.mu.Lock()
		delete(wsHub.clients, c)
		wsHub.mu.Unlock()
		c.Close()
	}()

	for {
		if _, _, err := c.ReadMessage(); err != nil {
			break
		}
	}
}

func pushRealtime(event models.RealtimeEvent) {
	select {
	case wsHub.broadcast <- event:
	default:
		log.Println("ws broadcast channel full, dropping event")
	}
}
