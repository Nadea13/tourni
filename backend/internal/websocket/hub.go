package websocket

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gofiber/contrib/websocket"
)

type EventType string

const (
	EventScoreUpdate      EventType = "score_update"
	EventMatchEvent       EventType = "match_event"
	EventMatchEventDelete EventType = "match_event_delete"
	EventMatchUpdate      EventType = "match_update"
	EventStatusChange     EventType = "status_change"
	EventStandingsSync    EventType = "standings_sync"
)

type WSMessage struct {
	Type      EventType   `json:"type"`
	MatchID   string      `json:"match_id,omitempty"`
	Payload   interface{} `json:"payload"`
	Timestamp int64       `json:"timestamp"`
}

type Client struct {
	Hub     *Hub
	Conn    *websocket.Conn
	Send    chan []byte
	MatchID string
}

type Hub struct {
	// matchID -> map of client pointer -> bool
	rooms      map[string]map[*Client]bool
	broadcast  chan WSMessage
	register   chan *Client
	unregister chan *Client
	mutex      sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]map[*Client]bool),
		broadcast:  make(chan WSMessage, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			if h.rooms[client.MatchID] == nil {
				h.rooms[client.MatchID] = make(map[*Client]bool)
			}
			h.rooms[client.MatchID][client] = true
			h.mutex.Unlock()
			log.Printf("🔌 Client connected to match room [%s] (Total: %d)", client.MatchID, len(h.rooms[client.MatchID]))

		case client := <-h.unregister:
			h.mutex.Lock()
			if room, ok := h.rooms[client.MatchID]; ok {
				if _, exists := room[client]; exists {
					delete(room, client)
					close(client.Send)
					if len(room) == 0 {
						delete(h.rooms, client.MatchID)
					}
				}
			}
			h.mutex.Unlock()
			log.Printf("🔌 Client disconnected from match room [%s]", client.MatchID)

		case message := <-h.broadcast:
			h.mutex.RLock()
			msgBytes, err := json.Marshal(message)
			if err == nil {
				// Broadcast to specific match room
				if room, ok := h.rooms[message.MatchID]; ok {
					for client := range room {
						select {
						case client.Send <- msgBytes:
						default:
							close(client.Send)
							delete(room, client)
						}
					}
				}
				// Also broadcast to global "all" room (if MatchID is not already "all")
				if message.MatchID != "all" {
					if room, ok := h.rooms["all"]; ok {
						for client := range room {
							select {
							case client.Send <- msgBytes:
							default:
								close(client.Send)
								delete(room, client)
							}
						}
					}
				}
			}
			h.mutex.RUnlock()
		}
	}
}

func (h *Hub) BroadcastMatchUpdate(matchID string, eventType EventType, payload interface{}) {
	h.broadcast <- WSMessage{
		Type:    eventType,
		MatchID: matchID,
		Payload: payload,
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			log.Printf("🔌 ReadPump closed for [%s]: %v", c.MatchID, err)
			break
		}
	}
}

func (c *Client) WritePump() {
	defer func() {
		c.Conn.Close()
	}()

	for message := range c.Send {
		if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
			break
		}
	}
}
