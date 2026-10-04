# Static marketing site, packaged as its own image — independent from the app
# frontend image. Build context is this directory:
#
#   docker build -t fluxsend-web:dev ./static-site
#
FROM nginx:alpine

# Drop the base image's default welcome page — otherwise it is served at
# /index.html instead of being unreachable.
RUN rm -f /usr/share/nginx/html/index.html /usr/share/nginx/html/50x.html

# Only these files are published. Listing them explicitly means a missing asset
# fails the build instead of turning into a silent 404 on the live site.
COPY landing.html fs.png favicon.svg /usr/share/nginx/html/

# Legal documents are published under /legal/ to match the landing page
# footer links (/legal/privacy-policy.html, /legal/terms-of-service.html).
COPY privacy-policy.html terms-of-service.html /usr/share/nginx/html/legal/

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
