FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
ENV NGINX_BACKEND_HOST=backend
ENV NGINX_BACKEND_PORT=3000
ENV NGINX_BACKEND_API_PORT=8091
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 8000
CMD ["nginx", "-g", "daemon off;"]
