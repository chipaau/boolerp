# Local dev proxy

Traefik + dnsmasq shared by every stack on this machine. The ERP compose file attaches to the
external `proxy` network and is routed by Host (`<tenant>.bool.test`, `admin.bool.test`,
`website.bool.test`, `mail.bool.test`); the Traefik dashboard is at `traefik.bool.test`.

## One-time setup (macOS)

```bash
docker network create proxy
sudo bash -c 'mkdir -p /etc/resolver && echo "nameserver 127.0.0.1" > /etc/resolver/bool.test'
```

The resolver file sends only `*.bool.test` lookups to the dnsmasq container on 127.0.0.1;
everything else keeps using the system DNS.

## Run

```bash
COMPOSE_PROFILES=local docker compose up -d
```

`local` enables dnsmasq. Without the profile only Traefik starts (for machines that resolve
`*.bool.test` some other way). Logs land in `logs/` and are git-ignored.
