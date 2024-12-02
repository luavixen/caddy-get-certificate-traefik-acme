# caddy-get-certificate-traefik-acme
Server that handles requests from the `http` Caddy TLS certificate manager using certificates from Traefik ACME `acme.json` storage files.

Specifically, this lets Caddy use certificates provided by [Traefik's ACME / Let's Encrypt support](https://doc.traefik.io/traefik/https/acme/) without much hassle.
This is great if you want to put Traefik behind Caddy and still have Traefik manage all of its own certificates.

## Authors
Made with ❤ by Lua ([foxgirl.dev](https://foxgirl.dev/))
