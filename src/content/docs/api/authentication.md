---
title: Authentication
description: Authenticate integration API requests with a project API key; key format, scopes and errors.
---

Every integration API request carries your project's API key in the `Authorization` header:

```http title="Request"
GET /top/v1/integration/votes?limit=100 HTTP/1.1
Host: api.l2nx.top
Authorization: Bearer nx_api_…
```

```sh title="curl"
curl -H "Authorization: Bearer $L2NX_API_KEY" \
  "https://api.l2nx.top/top/v1/integration/votes?limit=100"
```

The key identifies the project. You never pass the project in the request: every call works on the data of the
project the key belongs to.

## Key format

```text
nx_api_<30 random characters><6 checksum characters>
```

- Prefix `nx_api_`, then 36 characters from `0-9 A-Z a-z`: 43 characters in total.
- The last 6 characters are a checksum. A mistyped key is rejected before any lookup.
- Older keys of 39 characters without a checksum keep working.
- The prefix makes leaked keys easy to find with secret scanners.

## Scopes

A key carries a set of scopes; each endpoint requires one. Scope names follow `<service>.<resource>:<action>`.

| Scope                          | Grants                                      |
| ------------------------------ | ------------------------------------------- |
| `top.votes:read`               | l2nx.top vote feed and vote lookup by `ref` |
| `gamedata.item-templates:read` | Item templates of your game servers         |
| `gameservers.promo:redeem`     | Redeeming promo codes for players           |

Request only the scopes you use. Separate keys for separate systems (site, panel, bot) let you revoke one without
touching the others.

## Errors

Errors are [problem+json](/api/overview/#errors) responses.

| Status | `code`                    | Meaning                                                                |
| ------ | ------------------------- | ---------------------------------------------------------------------- |
| `401`  | none                      | No `Authorization: Bearer` header, a malformed key, or an unknown key. |
| `403`  | `API_KEY_REVOKED`         | The key was revoked.                                                   |
| `403`  | `API_KEY_EXPIRED`         | The key is past its expiry date.                                       |
| `403`  | `TENANT_DISABLED`         | The project is disabled on the platform.                               |
| `403`  | `API_KEY_TENANT_MISMATCH` | The key belongs to another project than the host you called.           |
| `403`  | `INSUFFICIENT_SCOPE`      | The key lacks the scope this endpoint requires.                        |

A `401` never tells whether a key exists: an unknown key and a wrong one look the same. Do not retry `401` or `403`
with the same key; fix the key or request a new one.

## Getting a key

Keys are issued on request: write to [support@l2nx.app](mailto:support@l2nx.app) with your project and the scopes you
need. For l2nx.top votes see [Getting access](/top/getting-access/).

The key is shown once. Revocation takes effect within a minute.

:::caution[Keep the key on your server]
An API key acts for your whole project. Use it only from server-side code. Never put it in a browser, a mobile app,
the game client, a public repository or logs. If a key may have leaked, ask support to revoke it at once.
:::
