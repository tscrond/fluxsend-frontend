FROM node:22-alpine AS build
WORKDIR /app

# Build-time configuration — Vite inlines these values into the bundle.
#   docker build --build-arg VITE_LANDING_ENABLED=false -t fluxsend-frontend:dev .
ARG VITE_API_BASE=""
ARG VITE_LANDING_ENABLED="false"

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_LANDING_ENABLED=$VITE_LANDING_ENABLED

RUN npm run build

FROM nginx:alpine
ENV NGINX_BACKEND_HOST=backend
ENV NGINX_BACKEND_PORT=3000
ENV NGINX_BACKEND_API_PORT=8091
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 8000
CMD ["nginx", "-g", "daemon off;"]
