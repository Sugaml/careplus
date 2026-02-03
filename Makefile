# CarePlus Pharmacy — Makefile
# Usage: make [target]

.PHONY: help build-frontend build-backend run-frontend run-backend \
	docker-build docker-build-frontend docker-build-backend \
	docker-run-frontend docker-run-backend clean dev-frontend dev-backend

# Default target
help:
	@echo "CarePlus — available targets:"
	@echo "  build-frontend       Build frontend (npm run build)"
	@echo "  build-backend        Build backend Go binary"
	@echo "  run-frontend         Run frontend dev server (npm run dev)"
	@echo "  run-backend          Run backend API (requires DB)"
	@echo "  docker-build         Build both frontend and backend images"
	@echo "  docker-build-frontend  Build frontend Docker image"
	@echo "  docker-build-backend   Build backend Docker image"
	@echo "  docker-run-frontend    Run frontend container (port 80)"
	@echo "  docker-run-backend     Run backend container (port 8090, needs env/DB)"
	@echo "  clean                Remove build artifacts and node_modules"
	@echo "  dev-frontend         Alias for run-frontend"
	@echo "  dev-backend          Alias for run-backend"

# ——— Local builds ———
build-frontend:
	cd frontend && npm ci && npm run build

build-backend:
	cd backend && go build -o api ./cmd/api

# ——— Local dev (no Docker) ———
run-frontend:
	cd frontend && npm run dev

run-backend:
	cd backend && go run ./cmd/api

dev-frontend: run-frontend
dev-backend: run-backend

# ——— Docker ———
DOCKER_IMAGE_FRONTEND ?= careplus-frontend
DOCKER_IMAGE_BACKEND  ?= careplus-backend
DOCKER_TAG            ?= latest

docker-build: docker-build-frontend docker-build-backend

docker-build-frontend:
	docker build -t $(DOCKER_IMAGE_FRONTEND):$(DOCKER_TAG) -f frontend/Dockerfile frontend

docker-build-backend:
	docker build -t $(DOCKER_IMAGE_BACKEND):$(DOCKER_TAG) -f backend/Dockerfile backend

# Run frontend container (serves on port 80; override with docker run -p)
docker-run-frontend: docker-build-frontend
	docker run --rm -p 8080:80 $(DOCKER_IMAGE_FRONTEND):$(DOCKER_TAG)

# Run backend container; pass env or use --env-file. Example:
#   make docker-run-backend
#   docker run -p 8090:8090 -e DB_HOST=host.docker.internal -e DB_PASSWORD=... careplus-backend
docker-run-backend: docker-build-backend
	@echo "Run with env (e.g. DB_HOST, DB_PASSWORD, PORT). Example:"
	@echo "  docker run --rm -p 8090:8090 --env-file backend/.env $(DOCKER_IMAGE_BACKEND):$(DOCKER_TAG)"
	docker run --rm -p 8090:8090 $$([ -f backend/.env ] && echo --env-file backend/.env) $(DOCKER_IMAGE_BACKEND):$(DOCKER_TAG)

# ——— Clean ———
clean:
	rm -rf frontend/dist frontend/node_modules
	rm -f backend/api
	@echo "Cleaned."
