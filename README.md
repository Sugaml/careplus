# CarePlus Pharmacy

Pharmacy management application with **backend** (Go + Gin + GORM + PostgreSQL) and **frontend** (React + Vite + TypeScript + Tailwind).

## Features

- **Pharmacy management** – Create and manage pharmacy profiles (name, license, address, contact).
- **Products management** – Catalog with SKU, category, price, stock, prescription flag.
- **Orders** – Create orders with line items, customer info, status workflow (pending → confirmed → processing → ready → completed).
- **Payments** – Record payments (cash, card, online), link to orders, complete/refund.
- **Auth** – JWT-based login/register; users belong to a pharmacy with roles (admin, pharmacist, staff).

## Structure

```
careplus/
├── backend/     # Go API (port 8090)
│   ├── cmd/api/
│   ├── internal/
│   │   ├── adapters/   # HTTP handlers, persistence, auth
│   │   ├── domain/     # models, services
│   │   ├── infrastructure/ # config, database, logger
│   │   └── ports/      # inbound (services), outbound (repos, auth)
│   ├── pkg/errors/
│   └── go.mod
├── frontend/    # React app (port 5174)
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── lib/
│   │   └── pages/
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Backend

### Prerequisites

- Go 1.24+
- PostgreSQL

### Setup

1. Create database: `createdb careplus_pharmacy_db`
2. Copy env and set secrets:

```bash
cd careplus/backend
# Create .env with at least:
# PORT=8090
# DB_HOST=localhost DB_PORT=5432 DB_USER=careplus DB_PASSWORD=careplus DB_NAME=careplus_pharmacy_db DB_SSL_MODE=disable
# JWT_ACCESS_SECRET=<min 32 chars>
# JWT_REFRESH_SECRET=<min 32 chars>
# CORS_ALLOWED_ORIGINS=http://localhost:5174
```

3. Seed demo data (optional, for quick login):

```bash
go run ./cmd/seed
```

Creates a demo pharmacy and test user **test@careplus.com** / **password123**. The frontend login page has a "Quick login (test user)" button.

4. Install and run:

```bash
go mod tidy
go run ./cmd/api
```

API base: `http://localhost:8090`. Health: `GET /health`. API v1: `GET/POST /api/v1/...`.

### API overview

- **Auth**: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me` (protected).
- **Pharmacies**: `GET/POST /api/v1/pharmacies`, `GET/PUT /api/v1/pharmacies/:id` (protected).
- **Products**: `GET/POST /api/v1/products`, `GET/PUT /api/v1/products/:id`, `PATCH /api/v1/products/:id/stock`, `DELETE /api/v1/products/:id` (protected).
- **Orders**: `GET/POST /api/v1/orders`, `GET /api/v1/orders/:id`, `PATCH /api/v1/orders/:id/status` (protected).
- **Payments**: `GET/POST /api/v1/payments`, `GET /api/v1/payments/:id`, `POST /api/v1/payments/:id/complete`, `GET /api/v1/orders/:orderId/payments` (protected).

## Frontend

### Setup

```bash
cd careplus/frontend
npm install
npm run dev
```

App: `http://localhost:5174`. Use "Quick login (test user)" for demo (requires `go run ./cmd/seed` in backend), or register a new account.

### Build

```bash
npm run build
```

## Design decisions

- **Backend**: Hexagonal-style layout (ports/adapters), domain models with GORM, JWT with pharmacy-scoped claims.
- **Frontend**: Single SPA with React Router, auth context storing token and user, API client with base URL and auth header.
- **Pharmacy-scoped data**: All product/order/payment APIs are scoped by `pharmacy_id` from the JWT after login.

## Edge cases and notes

- Product stock is decremented on order create; consider adding order cancellation and stock restoration.
- Payments are linked to orders; complete flow (order → payment → complete) can be extended with refunds.
- First-time setup: run `go run ./cmd/seed` in backend to create demo pharmacy and test user (test@careplus.com / password123), or create a pharmacy via API and register a user with that `pharmacy_id`.

## Performance

- Backend uses connection pooling and structured logging (zap).
- Frontend uses Vite for fast dev and builds; consider code-splitting per route if the app grows.

## User feedback

- Document bootstrap flow (create pharmacy + first user) in README or a setup script.
- Add pagination and filters to product/order list APIs and UI when data grows.
