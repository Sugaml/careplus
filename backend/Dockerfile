# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install git (needed for some Go modules) and ca-certificates
RUN apk add --no-cache git ca-certificates

# Copy go mod files first for better layer caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o api ./cmd/api

# Production stage: minimal runtime
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/api .

# Optional: create non-root user
RUN adduser -D -g '' appuser
USER appuser

EXPOSE 8090

# Config is loaded from env / .env at runtime (mount or pass env in docker run / compose)
ENTRYPOINT ["./api"]
