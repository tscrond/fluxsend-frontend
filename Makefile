# Build the app image without the landing page (serve it from ./static-site instead):
#   make build LANDING_ENABLED=false
LANDING_ENABLED ?= false

.PHONY: build
build:
	docker build --build-arg VITE_LANDING_ENABLED=$(LANDING_ENABLED) -t fluxsend-frontend:dev . &&\
  docker build -t fluxsend-web:dev ./static-site &&\
  cd /home/tskr/projects/fluxsend-backend/ &&\
  docker build -t fluxsend-backend:dev . &&\
  cd -

.PHONY: static
static:
	docker build -t fluxsend-web:dev ./static-site

.PHONY: deploy
deploy:
	cd /home/tskr/projects/fluxsend-backend/ && docker compose up -d --force-recreate --remove-orphans && cd -
