# CarePlus Chat Feature – Design Plan

This document describes the design for the **chat feature** between pharmacists (pharmacy staff) and end customers, including **WebSocket** and **REST API**, plus **file and photo sharing**.

---

## 1. Overview

### 1.1 Goals

- **Pharmacist ↔ Customer** messaging: pharmacy staff can chat with customers (e.g. prescription queries, product questions, order follow-up).
- **Dual transport**: REST API for history, sending messages, and fallback; WebSocket for real-time delivery and typing/read indicators.
- **Attachments**: support **photos** and **files** (same policy as existing upload: images, PDF, Word; max 10 MiB).

### 1.2 Participants

| Role        | Identity                    | Where they chat              |
|------------|-----------------------------|------------------------------|
| Pharmacist | `User` (JWT: `user_id`, `pharmacy_id`, `role`) | Dashboard (staff UI)          |
| Customer   | `Customer` (pharmacy + phone) | Store/website (customer UI)   |

Customers do not have a normal login; they are identified by **pharmacy_id + customer_id** (and optionally phone). Customer chat access is via a **signed token** or **phone-based session** (see §2.5).

---

## 2. Backend Design

### 2.1 Data Model

#### 2.1.1 Conversation

One conversation per **(pharmacy, customer)**. Any staff member of that pharmacy can participate.

```go
// internal/domain/models/conversation.go
type Conversation struct {
    ID         uuid.UUID
    PharmacyID uuid.UUID
    CustomerID uuid.UUID
    CreatedAt  time.Time
    UpdatedAt  time.Time

    Pharmacy *Pharmacy
    Customer *Customer
}
```

- **Uniqueness**: `(pharmacy_id, customer_id)` unique so one thread per customer per pharmacy.
- **Last message** for list ordering can be derived from `messages` (e.g. `MAX(created_at)`) or cached in a `last_message_at` column on `conversations` (updated on new message).

#### 2.1.2 Message

```go
// internal/domain/models/chat_message.go
type ChatMessage struct {
    ID             uuid.UUID
    ConversationID uuid.UUID
    SenderType     string   // "user" | "customer"
    SenderID       uuid.UUID  // user_id or customer_id
    Body           string     // plain text; empty if attachment-only
    AttachmentURL  string     // optional; from existing FileStorage
    AttachmentName string     // original filename
    AttachmentType string     // MIME or "image"|"file" for display
    CreatedAt      time.Time

    Conversation *Conversation
}
```

- **SenderType**: `"user"` = pharmacy staff, `"customer"` = customer.
- **SenderID**: for `user` → `users.id`; for `customer` → `customers.id`.
- Attachments re-use existing **FileStorage** (local or S3). Path convention e.g. `chat/photos/<conversation_id>/<year>/<month>/<uuid>.<ext>` or `chat/files/...`.

#### 2.1.3 Optional: Read receipt / last read

For “last read at” or unread count:

```go
// Optional
type ConversationParticipant struct {
    ConversationID uuid.UUID
    ParticipantType string   // "user" | "customer"
    ParticipantID   uuid.UUID
    LastReadAt     *time.Time
}
```

Or a single `last_read_at` per conversation for the customer (when the customer last read), and per-user last read for staff. Can be added in a later iteration.

### 2.2 Repositories (Ports)

**ConversationRepository**

- `Create(ctx, c *Conversation) error`
- `GetByID(ctx, id uuid.UUID) (*Conversation, error)`
- `GetByPharmacyAndCustomer(ctx, pharmacyID, customerID uuid.UUID) (*Conversation, error)` — for get-or-create
- `ListByPharmacy(ctx, pharmacyID uuid.UUID, limit, offset int) ([]*Conversation, int64, error)` — with last message snippet and unread hint if needed

**ChatMessageRepository**

- `Create(ctx, m *ChatMessage) error`
- `ListByConversationID(ctx, conversationID uuid.UUID, limit, offset int) ([]*ChatMessage, int64, error)` — ordered by `created_at DESC` for “latest first” pagination
- Optional: `MarkRead(ctx, conversationID, participantType string, participantID uuid.UUID, at time.Time) error`

### 2.3 Service (Application Layer)

**ChatService** (inbound port):

- `GetOrCreateConversation(ctx, pharmacyID, customerID uuid.UUID) (*Conversation, error)`
- `ListConversations(ctx, pharmacyID uuid.UUID, limit, offset int) ([]*Conversation, int64, error)` — for staff; include last message and optional unread count
- `GetConversation(ctx, conversationID uuid.UUID) (*Conversation, error)` — with permission check (pharmacy or customer)
- `ListMessages(ctx, conversationID uuid.UUID, limit, offset int) ([]*ChatMessage, int64, error)`
- `SendMessage(ctx, conversationID uuid.UUID, senderType string, senderID uuid.UUID, body string, attachmentURL, attachmentName, attachmentType string) (*ChatMessage, error)`
- Optional: `MarkConversationRead(ctx, conversationID uuid.UUID, participantType string, participantID uuid.UUID) error`

Permission rules:

- **Staff**: can access any conversation for their `pharmacy_id`; send with `sender_type=user`, `sender_id=user_id`.
- **Customer**: can access only conversations where `customer_id` matches; send with `sender_type=customer`, `sender_id=customer_id`.

### 2.4 REST API

All under `/api/v1`, with auth (see §2.5).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/chat/conversations` | Staff (JWT) | List conversations for pharmacy (paginated). |
| POST | `/chat/conversations` | Staff | Create or get conversation (body: `customer_id`). |
| GET | `/chat/conversations/:id` | Staff or Customer | Get one conversation (with permission check). |
| GET | `/chat/conversations/:id/messages` | Staff or Customer | List messages (paginated, `limit`, `offset`). |
| POST | `/chat/conversations/:id/messages` | Staff or Customer | Send message (body: `body`, optional `attachment_url`, `attachment_name`, `attachment_type`). |
| POST | `/upload` (existing) | Any auth | Upload file/photo; use returned `url` in message body. |

**Sending with attachment (flow)**:

1. Client uploads file via existing `POST /api/v1/upload` (multipart `file` or `photo`).
2. Backend returns `{ url, path, filename }`.
3. Client sends message with `body` (optional) and `attachment_url`, `attachment_name`, `attachment_type` (e.g. `image/jpeg` or `"image"` / `"file"`).

Alternatively, add a dedicated `POST /chat/upload` that returns the same shape and stores under `chat/...` paths; internally still uses same `FileStorage`.

### 2.5 Authentication and Customer Access

- **Staff**: existing JWT (Bearer). Middleware already provides `user_id`, `pharmacy_id`, `role`. Use for all staff-only and staff-scoped chat endpoints.
- **Customer**: two options.

  **Option A – Signed chat token (recommended)**  
  - Backend endpoint (staff or public): e.g. `POST /api/v1/chat/customer-token` with body `{ "customer_id" }` (staff only) or a public endpoint that takes `phone` + OTP and returns a short-lived **chat token** (JWT) containing `pharmacy_id`, `customer_id`, `exp`.  
  - Customer opens store with `?chat_token=...` or receives link (e.g. SMS) with token. Frontend stores token and uses it for chat API and WebSocket.  
  - Middleware: if `Authorization: Bearer <chat_token>` and token has `aud=chat_customer`, allow access only to that customer’s conversation(s).

  **Option B – Phone + session**  
  - Customer enters phone on store; backend looks up or creates `Customer`, creates a session (e.g. signed cookie or short-lived JWT) for that customer. Same token used for chat API and WebSocket.

For **MVP**, a simple approach: **staff-only creation of chat link**. Staff selects customer and “Start chat” → backend generates short-lived JWT with `pharmacy_id`, `customer_id`; staff copies link or sends to customer (e.g. `https://<store>/chat?token=...`). Customer opens link; frontend uses token for chat.

### 2.6 WebSocket Design

- **Path**: e.g. `GET /api/v1/chat/ws` or `GET /ws/chat` (same host as API).
- **Authentication**:  
  - **Staff**: `?token=<access_token>` (existing JWT).  
  - **Customer**: `?token=<chat_token>` (customer chat JWT).
- **Protocol**: JSON messages.

**Client → Server**

| Type | Payload | Meaning |
|------|---------|--------|
| `ping` | — | Keepalive. |
| `send_message` | `conversation_id`, `body`, `attachment_url?`, `attachment_name?`, `attachment_type?` | Send message (server persists and broadcasts). |
| `typing` | `conversation_id`, `is_typing` | Typing indicator. |
| `read` | `conversation_id` | Mark as read (optional). |

**Server → Client**

| Type | Payload | Meaning |
|------|---------|--------|
| `pong` | — | Response to ping. |
| `new_message` | full message object | New message in a conversation (to other participants). |
| `typing` | `conversation_id`, `sender_type`, `sender_id`, `is_typing` | Someone is typing. |
| `read` | `conversation_id`, `participant_type`, `participant_id`, `at` | Read receipt (optional). |
| `error` | `code`, `message` | Validation or permission error. |

**Hub / routing**

- **Global hub** that maps:
  - Staff: `user_id` → connection(s) (one user can have one or more tabs).
  - Customer: `customer_id` (or composite `pharmacy_id:customer_id`) → connection(s).
- On **send_message**: server saves message via `ChatService.SendMessage`, then looks up other participants of the conversation (all staff of the pharmacy for that conversation + the customer) and pushes `new_message` to their connections.
- **Conversation membership**: for “pharmacy” side, all users with that `pharmacy_id` can be considered participants (or only those who have the conversation “open” — simpler is to broadcast to all pharmacy connections for that pharmacy).

**Implementation (Go)**

- Use `gorilla/websocket` or `nhooyr.io/websocket`.
- Upgrader on same server as HTTP; auth by reading `token` query (or first message) and validating JWT; then register connection in hub.
- Hub: in-memory map `userID -> []*Conn` and `customerKey -> []*Conn`; mutex-protected; on new message, find conversation, then find all participant connections and write `new_message`.
- Graceful shutdown: on shutdown, close all connections.

### 2.7 File and Photo Sharing

- **Allowed types**: same as existing upload handler — images (jpeg, png, gif, webp, svg), PDF, Word. Max size **10 MiB**.
- **Storage**: reuse `FileStorage` (local or S3). Path prefix e.g. `chat/photos/` or `chat/files/` + conversation or date-based subdir + UUID filename.
- **Upload**: existing `POST /upload` with auth (staff JWT or customer chat token); optional dedicated `POST /chat/upload` that restricts to chat and returns same `{ url, path, filename }`.
- **Security**: ensure conversation permission check when attaching a URL to a message (e.g. only allow attachment_url that belongs to same conversation or same user/customer). Alternatively, store uploads under a namespace that includes conversation_id so only that conversation’s participants can reference them.

---

## 3. Frontend Design

### 3.1 Dashboard (Pharmacist / Staff)

- **Route**: e.g. `/manage/chat` or `/chat`.
- **Sidebar**: “Chat” entry (icon: MessageCircle or similar); visible to roles that can chat (e.g. pharmacist, staff, manager, admin).
- **Layout**:
  - **Left**: list of conversations (customer name, phone, last message preview, time, optional unread badge). Search/filter by customer name or phone. Click to select.
  - **Right**: selected conversation:
    - Header: customer name, phone.
    - Message list (scrollable, newest at bottom or top with “load more” above). Messages show sender (You / Customer / Staff name), body, optional image/file thumbnail and link, timestamp.
    - Input: text box + “Attach” (file/photo) + Send. On attach, upload via `apiUpload('/upload', formData)`, then send message with `attachment_url`, `attachment_name`, `attachment_type`.
- **Real-time**: WebSocket connection when page is open; on `new_message` for current conversation, append to list and optionally scroll to bottom; on `typing`, show “Customer is typing…” (or staff name).
- **Fallback**: if WebSocket is disconnected, still send via `POST /chat/conversations/:id/messages` and poll or refetch messages periodically until WS reconnects.

### 3.2 Store / Customer

- **Entry**: “Chat” in header or floating chat button (e.g. bottom-right). Opens a panel or full-page chat.
- **Auth**: customer must have opened the app with a chat token (e.g. `?chat_token=...`). If no token, show “To chat with the pharmacy, use the link sent to you” or “Enter your phone to start” (if using Option B).
- **Layout**:
  - Single conversation (one per customer). Header: pharmacy name / “Pharmacy support”.
  - Message list + input + attach (same as dashboard). Upload uses same `POST /upload` with customer chat token in `Authorization`.
- **WebSocket**: connect with chat token; receive `new_message` and `typing`; send `send_message` and `typing`.

### 3.3 API Client (Frontend)

- **REST** (in `lib/api.ts` or similar):
  - `chatApi.listConversations(limit?, offset?)`
  - `chatApi.getOrCreateConversation(customerId)` (staff)
  - `chatApi.getConversation(conversationId)`
  - `chatApi.listMessages(conversationId, limit?, offset?)`
  - `chatApi.sendMessage(conversationId, { body?, attachment_url?, attachment_name?, attachment_type? })`
  - Optional: `chatApi.getCustomerChatToken(customerId)` (staff) → returns token or link for customer.
- **WebSocket**: helper (e.g. `useChatSocket(conversationId)` or a small `ChatSocket` class) that:
  - Connects to `wss://<host>/api/v1/chat/ws?token=...` (or same path with API origin).
  - Sends `ping` periodically; handles `pong`.
  - On `send_message`, emits and optionally optimistically appends; on `new_message`, appends and notifies.
  - Exposes `sendMessage(...)`, `sendTyping(isTyping)`, and callback for `onMessage`, `onTyping`.

### 3.4 File/Photo UX

- **Attach button**: file input (accept images + PDF/Word); on select, upload with `apiUpload`, then either auto-send with attachment or fill attachment fields and let user add text and send.
- **Display**: images inline (thumb or full width); files as link with icon + filename. Use existing `resolveImageUrl` for image URLs from backend.
- **Errors**: file too large or wrong type → show message; 413/415 from upload → same.

---

## 4. Implementation Order

1. **Backend – Data and REST**
   - Models: `Conversation`, `ChatMessage`; migrations or AutoMigrate.
   - Repositories and ChatService; permission checks (pharmacy + customer).
   - REST routes; staff JWT auth. Optional: customer chat token issue (staff-only) and middleware for chat token.
2. **Backend – WebSocket**
   - Hub, upgrade handler, auth via query token; handle `send_message`, persist, broadcast `new_message`; optional `typing` and `read`.
3. **Backend – Customer token**
   - Issue short-lived JWT for customer (e.g. `POST /chat/customer-token` with `customer_id` for staff); middleware that accepts either staff JWT or customer chat JWT for chat routes.
4. **Frontend – Dashboard**
   - Chat page: conversation list (REST), message list (REST), send message (REST then WS). Then integrate WebSocket for live updates and typing.
5. **Frontend – Customer**
   - Chat panel/page; token from URL or session; same message list and send; WebSocket with chat token.
6. **Attachments**
   - Ensure upload returns URL usable in messages; wire attach button to upload + send message with attachment fields; display images and file links in both UIs.

---

## 5. Security and Limits

- **Rate limiting**: limit message send (e.g. per user/customer per minute) to avoid abuse.
- **Moderation**: optional flag/report; no in-scope content filtering in this design.
- **PII**: messages may contain health info; ensure HTTPS and access control; optional audit log for chat access.
- **File scan**: optional virus scan for uploads (future).

---

## 6. Summary

| Area | Choice |
|------|--------|
| **Conversation** | One per (pharmacy, customer). |
| **Message** | Text + optional attachment (URL from existing upload). |
| **REST** | List/get conversations, list/send messages; upload via existing or dedicated chat upload. |
| **WebSocket** | Authenticate by JWT (staff) or chat token (customer); JSON protocol; hub broadcasts `new_message` and optional `typing`/`read`. |
| **Files/photos** | Same types and size as current upload; stored via FileStorage under `chat/...`. |
| **Customer access** | Short-lived chat token (issued by staff or via phone flow); token in URL or session for customer UI. |

This plan aligns with the existing CarePlus stack (Go, Gin, GORM, React, TypeScript, existing auth and upload) and keeps file sharing consistent with the current upload handler while adding real-time chat for pharmacists and end customers.
