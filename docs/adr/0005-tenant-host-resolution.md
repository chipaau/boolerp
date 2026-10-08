# ADR 0005: Resolving a tenant host to the workspace or a portal

Date: 2026-10-08.
Status: accepted (C191, C192, C193).

## Context

A tenant reaches Bool on hosts it controls. Its workspace sits on `cyryx.bool.mv` or its
own `workspace.cyryx.edu.mv`, and C132 lets it run portals by audience, each on its own
domains. C191 settled that a portal is **always** on the tenant's own verified domain:
Bool hosts no portal host, because a nested `portal.<slug>.bool.mv` is outside a
`*.bool.mv` wildcard — a wildcard matches exactly one label — and would need a
certificate per tenant, and because it would make a public portal a cookie child of the
staff workspace host.

That leaves every host arbitrary. `workspace.cyryx.edu.mv` and `portal.cyryx.edu.mv` are
indistinguishable to a reverse proxy: nothing in the name says which is which. Only the
`domains` table knows, through the narrow lookup of C131, which returns the tenant and
what the host serves.

Development has been standing in for this by naming the seeded hosts in `compose.yaml`.
That cannot be the design: the set of hosts is customer data that changes when a domain
is verified, activated or revoked, and it is not known when the deployment is configured.

Two things could have absorbed the lookup and do not. The proxy cannot: a rule is static,
and making it dynamic would couple routing to one proxy, which a self-hosted deployment
may not use, and would leave a portal dark until configuration propagated. The
application cannot: the request has to arrive somewhere before anything can read a header,
and the thing it arrives at is what must choose.

## Decision

The BFF program gains a **resolver role**, deployed as one more instance the way
`bff-admin` is an instance of the same program (C90, C96, C97). Every tenant host is
routed to it. For each request it calls `domain_lookup` (C131), caches the result, and
dispatches on `serves`:

- `workspace` — to the workspace BFF, which serves the embedded SPA, `/auth` and `/api`
  as it does today.
- a portal key such as `academics.student` — to that portal's BFF instance.

A host the lookup does not return is one 404, as C131 requires: the resolver fails closed
and never guesses a tenant.

A portal behind it is a Vite SPA embedded in its own BFF instance rather than a Next.js
service (C192). A portal needs no server of its own: C84 keeps every login page on the
identity service's domain, so a portal redirects and never renders a login form, and its
public pages are not required to be findable in search. The session therefore lives where
the workspace's already does.

## Consequences

The lookup is on the path of every tenant request, so it is cached, and **the cache's
invalidation when a domain is activated or revoked is still to be designed** — a revoked
host that keeps resolving is the failure that matters, so revocation has to be immediate
rather than waiting for a TTL.

One hop is added between the proxy and the BFF that answers. In exchange the proxy's
configuration stays static and identical in development, SaaS and self-hosted
deployments, and a new verified domain works the moment it is active, with no
configuration to propagate.

Nothing new is built, scanned or deployed: the resolver is the BFF image with a different
role, so it inherits its base image, its scanning and its release process. The cost is
that one program now has two shapes, and the role has to be explicit in configuration
rather than implied.

Portals add no Node service to a deployment. The trade is that a portal's public pages are
client-rendered; if any of them ever has to be indexed, those pages are split out or
prerendered then, rather than every portal carrying a server for the possibility.

Hosts remain untrusted. The resolver establishes which tenant a request is *for*; it never
establishes access, which membership and Cerbos decide, exactly as C131 requires.
