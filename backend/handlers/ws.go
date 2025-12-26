package handlers

import (
	"encoding/json"
	"log"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/tss-booking-system/backend/models"
)

type hub struct {
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
			for c := range wsHub.clients {
				if err := c.WriteMessage(websocket.TextMessage, payload); err != nil {
					log.Println("ws write:", err)
					c.Close()
					delete(wsHub.clients, c)
				}
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
	wsHub.clients[c] = true
	defer func() {
		delete(wsHub.clients, c)
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
