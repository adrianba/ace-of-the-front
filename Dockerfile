FROM nginxinc/nginx-unprivileged:1.29-alpine

LABEL org.opencontainers.image.source="https://github.com/adrianba/ace-of-the-front" \
      org.opencontainers.image.description="Ace of the Front: a browser-based WWI biplane arcade game"

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY src/ace_of_the_front/static/ /usr/share/nginx/html/

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
