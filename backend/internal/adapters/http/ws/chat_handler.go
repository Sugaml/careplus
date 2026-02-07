package ws

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 64 << 10
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Incoming client message types
const (
	MsgPing        = "ping"
	MsgSendMessage = "send_message"
	MsgTyping      = "typing"
)

// Outgoing server message types
const (
	MsgPong        = "pong"
	MsgNewMessage  = "new_message"
	MsgTypingEvent = "typing"
	MsgError       = "error"
)

type wireMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

type sendMessageData struct {
	ConversationID string `json:"conversation_id"`
	Body           string `json:"body"`
	AttachmentURL  string `json:"attachment_url"`
	AttachmentName string `json:"attachment_name"`
	AttachmentType string `json:"attachment_type"`
}

type typingData struct {
	ConversationID string `json:"conversation_id"`
	IsTyping       bool   `json:"is_typing"`
}

// HandleWS upgrades the connection and runs the chat loop. Token must be in query "token".
func HandleWS(
	authProvider outbound.AuthProvider,
	userRepo outbound.UserRepository,
	chatService inbound.ChatService,
	convRepo outbound.ConversationRepository,
	hub *Hub,
	logger *zap.Logger,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.Query("token")
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED", "message": "missing token"})
			return
		}
		ctx := c.Request.Context()
		pharmacyID, userID, customerID, err := validateToken(ctx, authProvider, userRepo, token)
		if err != nil {
			logger.Warn("chat ws auth failed", zap.Error(err))
			c.JSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED", "message": "invalid token"})
			return
		}
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			logger.Warn("chat ws upgrade failed", zap.Error(err))
			return
		}
		client := &Client{
			PharmacyID: pharmacyID,
			UserID:     userID,
			CustomerID: customerID,
			Send:       make(chan []byte, 256),
		}
		hub.Register(client)
		defer func() {
			hub.Unregister(client)
			conn.Close()
		}()

		conn.SetReadLimit(maxMessageSize)
		conn.SetReadDeadline(time.Now().Add(pongWait))
		conn.SetPongHandler(func(string) error {
			conn.SetReadDeadline(time.Now().Add(pongWait))
			return nil
		})

		go writePump(conn, client, logger)
		readPump(ctx, conn, client, chatService, convRepo, hub, logger)
	}
}

func validateToken(ctx context.Context, authProvider outbound.AuthProvider, userRepo outbound.UserRepository, token string) (pharmacyID uuid.UUID, userID *uuid.UUID, customerID *uuid.UUID, err error) {
	claims, err := authProvider.ValidateAccessToken(token)
	if err == nil && claims != nil {
		user, err := userRepo.GetByID(ctx, claims.UserID)
		if err != nil || user == nil || !user.IsActive {
			return uuid.Nil, nil, nil, err
		}
		return claims.PharmacyID, &claims.UserID, nil, nil
	}
	chatClaims, err := authProvider.ValidateChatCustomerToken(token)
	if err == nil && chatClaims != nil {
		return chatClaims.PharmacyID, nil, &chatClaims.CustomerID, nil
	}
	return uuid.Nil, nil, nil, err
}

func readPump(
	ctx context.Context,
	conn *websocket.Conn,
	client *Client,
	chatService inbound.ChatService,
	convRepo outbound.ConversationRepository,
	hub *Hub,
	logger *zap.Logger,
) {
	defer close(client.Send)
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				logger.Debug("chat ws read error", zap.Error(err))
			}
			break
		}
		var msg wireMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			sendError(client, "invalid json")
			continue
		}
		switch msg.Type {
		case MsgPing:
			client.Send <- mustMarshal(wireMessage{Type: MsgPong})
		case MsgSendMessage:
			var body sendMessageData
			if err := json.Unmarshal(msg.Data, &body); err != nil || body.ConversationID == "" {
				sendError(client, "invalid send_message data")
				continue
			}
			convID, _ := uuid.Parse(body.ConversationID)
			var senderType string
			var senderID uuid.UUID
			if client.CustomerID != nil {
				senderType = models.SenderTypeCustomer
				senderID = *client.CustomerID
			} else {
				senderType = models.SenderTypeUser
				senderID = *client.UserID
			}
			message, err := chatService.SendMessage(ctx, convID, senderType, senderID, body.Body, body.AttachmentURL, body.AttachmentName, body.AttachmentType)
			if err != nil {
				sendError(client, err.Error())
				continue
			}
			conv, err := convRepo.GetByID(ctx, convID)
			if err == nil {
				payload := mustMarshal(wireMessage{Type: MsgNewMessage, Data: mustMarshal(message)})
				hub.BroadcastToConversation(conv.PharmacyID, conv.CustomerID, payload)
			}
		case MsgTyping:
			var body typingData
			if err := json.Unmarshal(msg.Data, &body); err != nil {
				continue
			}
			convID, _ := uuid.Parse(body.ConversationID)
			conv, err := convRepo.GetByID(ctx, convID)
			if err != nil {
				continue
			}
			payload := mustMarshal(map[string]interface{}{
				"type":             MsgTypingEvent,
				"conversation_id":  body.ConversationID,
				"is_typing":        body.IsTyping,
				"sender_type":      "user",
				"sender_id":        "",
			})
			if client.CustomerID != nil {
				payload = mustMarshal(map[string]interface{}{
					"type":            MsgTypingEvent,
					"conversation_id": body.ConversationID,
					"is_typing":       body.IsTyping,
					"sender_type":     "customer",
					"sender_id":       client.CustomerID.String(),
				})
			}
			hub.BroadcastToConversation(conv.PharmacyID, conv.CustomerID, payload)
		}
	}
}

func writePump(conn *websocket.Conn, client *Client, logger *zap.Logger) {
	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()
	for {
		select {
		case msg, ok := <-client.Send:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				conn.WriteMessage(websocket.CloseMessage, nil)
				return
			}
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func sendError(client *Client, message string) {
	client.Send <- mustMarshal(wireMessage{Type: MsgError, Data: mustMarshal(gin.H{"message": message})})
}

func mustMarshal(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}
