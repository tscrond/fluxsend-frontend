.PHONY: build
build:
	docker build -t fluxsend-frontend:dev . &&\
  cd /home/tskr/projects/fluxsend-backend/ &&\
  docker build -t fluxsend-backend:dev . &&\
  cd -

.PHONY: deploy
deploy:
	cd /home/tskr/projects/fluxsend-backend/ && docker compose up -d --force-recreate --remove-orphans && cd -