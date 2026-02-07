package ws

import (
	"sync"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Client is a WebSocket client (staff or customer).
type Client struct {
	PharmacyID uuid.UUID
	UserID     *uuid.UUID // staff
	CustomerID *uuid.UUID // customer
	Send       chan []byte
}

// Hub holds registered clients and broadcasts messages.
type Hub struct {
	// pharmacyID -> staff clients
	pharmacies map[uuid.UUID]map[*Client]struct{}
	// customerID -> customer clients
	customers map[uuid.UUID]map[*Client]struct{}
	mu        sync.RWMutex
	logger    *zap.Logger
}

func NewHub(logger *zap.Logger) *Hub {
	return &Hub{
		pharmacies: make(map[uuid.UUID]map[*Client]struct{}),
		customers:  make(map[uuid.UUID]map[*Client]struct{}),
		logger:     logger,
	}
}

func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if client.CustomerID != nil {
		if h.customers[*client.CustomerID] == nil {
			h.customers[*client.CustomerID] = make(map[*Client]struct{})
		}
		h.customers[*client.CustomerID][client] = struct{}{}
	} else {
		if h.pharmacies[client.PharmacyID] == nil {
			h.pharmacies[client.PharmacyID] = make(map[*Client]struct{})
		}
		h.pharmacies[client.PharmacyID][client] = struct{}{}
	}
}

func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if client.CustomerID != nil {
		if m := h.customers[*client.CustomerID]; m != nil {
			delete(m, client)
			if len(m) == 0 {
				delete(h.customers, *client.CustomerID)
			}
		}
	} else {
		if m := h.pharmacies[client.PharmacyID]; m != nil {
			delete(m, client)
			if len(m) == 0 {
				delete(h.pharmacies, client.PharmacyID)
			}
		}
	}
}

// BroadcastToConversation sends payload to all staff of the pharmacy and, when customerID is set, to that customer.
// For user-scoped conversations (customerID nil), only pharmacy staff (including the end user) receive the message.
func (h *Hub) BroadcastToConversation(pharmacyID uuid.UUID, customerID *uuid.UUID, payload []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.pharmacies[pharmacyID] {
		select {
		case c.Send <- payload:
		default:
			h.logger.Debug("chat client send buffer full, skip")
		}
	}
	if customerID != nil {
		for c := range h.customers[*customerID] {
			select {
			case c.Send <- payload:
			default:
				h.logger.Debug("chat client send buffer full, skip")
			}
		}
	}
}

