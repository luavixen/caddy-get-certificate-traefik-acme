FROM oven/bun:1.1.38-debian

WORKDIR /build/
COPY . /build/

RUN bun run build

FROM debian:12.8-slim

COPY --from=0 /build/caddy-get-certificate-traefik-acme /usr/local/bin/caddy-get-certificate-traefik-acme

ENTRYPOINT ["caddy-get-certificate-traefik-acme"]
