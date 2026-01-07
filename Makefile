DOCKER_COMPOSE ?= docker-compose

.PHONY: up down logs fmt seed

up:
	$(DOCKER_COMPOSE) up -d --build

down:
	$(DOCKER_COMPOSE) down

logs:
	$(DOCKER_COMPOSE) logs -f

fmt:
	cd backend && go fmt ./...

seed:
	curl -X POST http://localhost:8090/debug/seed-admin || true