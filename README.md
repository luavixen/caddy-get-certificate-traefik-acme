# caddy-get-certificate-traefik-acme
Server that handles requests from the `http` Caddy TLS certificate manager using certificates from Traefik ACME `acme.json` storage files.

Specifically, this lets Caddy use certificates provided by [Traefik's ACME / Let's Encrypt support](https://doc.traefik.io/traefik/https/acme/) without much hassle.
This is great if you want to put Traefik behind Caddy and still have Traefik manage all of its own certificates.

Usage is simple:
```sh
docker run \
  -p 3000:3000 \
  -v "/etc/traefik/acme.json:/acme.json" \
  luavixen/caddy-get-certificate-traefik-acme:latest
```
You can also source certificates from multiple files:
```sh
docker run \
  -p 3000:3000 \
  -v "/etc/traefik/acme:/acme" \
  -e ACME_STORAGE_PATH=/acme/acme1.json:/acme/acme2.json \
  luavixen/caddy-get-certificate-traefik-acme:latest
```

I use this with [Dokploy](https://dokploy.com/) as I really like it, but I already use Caddy as my proxy.
Since Dokploy runs and manages its own Traefik instance, and routes everything through that, I needed to make Caddy send unmatched requests to Traefik transparently.

So, with Caddy handling ports 80 and 443, Traefik running behind it on 7080 and 7443, and `caddy-get-certificate-traefik-acme` on 3000, my Caddyfile looks something like this:
```caddyfile
# ... a bunch of Caddy-handled sites ...

# Match all HTTP requests and proxy them to Traefik
http:// {
  reverse_proxy http://localhost:7080
}

# Match all HTTPS requests and proxy them to Traefik, but with the right certificates! :D
https:// {
  tls {
    # The magic is here:
    get_certificate http http://localhost:3000/
  }
  reverse_proxy {
    to https://localhost:7443
    transport http {
      tls_server_name {http.request.host}
    }
  }
}
```

Of course, this means that Caddy has to decrypt and re-encrypt everything, which sucks. But it works!

## Authors
Made with ❤ by Lua ([foxgirl.dev](https://foxgirl.dev/))
