---
title: Overview
description:
  "The L2NX integration API for your site and tools: hosts, paths, versioning, pagination, errors and rate limits."
---

The integration API is the HTTP API that your site, panel or bot calls server to server. Every request is made on behalf
of your tenant — your project on the L2NX platform — with its [API key](/api/authentication/).

## What is available

| Service   | What you can do                                               | Scope                          | Reference                                                                 |
| --------- | ------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------- |
| l2nx.top  | Read the vote feed, look votes up by `ref`                    | `top.votes:read`               | [page](/api/top/) · [OpenAPI JSON](/api/top/openapi.json)                 |
| Game data | Read item templates of your game servers                      | `gamedata.item-templates:read` | [page](/api/gamedata/) · [OpenAPI JSON](/api/gamedata/openapi.json)       |
| Promo     | Redeem promo codes for players, for example from a user panel | `gameservers.promo:redeem`     | [page](/api/gameservers/) · [OpenAPI JSON](/api/gameservers/openapi.json) |

Reference pages for each service are generated from its OpenAPI description and listed under **Integration API** in the
sidebar. They are updated automatically with every release of the service. The OpenAPI 3.1 document of a service can be
downloaded as JSON, from the table above or from its reference page, to generate a client.

## Hosts and paths

Every service exposes the API under its own prefix:

```text
https://{host}/{service}/v{N}/integration/...
```

| Service     | Host                            | Example                                                                 |
| ----------- | ------------------------------- | ----------------------------------------------------------------------- |
| l2nx.top    | `https://api.l2nx.top`          | `https://api.l2nx.top/top/v1/integration/votes`                         |
| Tenant APIs | `https://{tenant}.api.l2nx.app` | `https://myproject.api.l2nx.app/gamedata/v1/integration/item-templates` |

On the tenant host `{tenant}` is your tenant slug. The tenant comes from the API key: a key works only on its own
tenant's host, a key of another tenant gets `403 API_KEY_TENANT_MISMATCH`.

## Headers

| Header          | When                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `Authorization` | Always: your [API key](/api/authentication/).                                                             |
| `Server-Slug`   | Operations of one game server: the server slug, as in its URLs (for example `main`). Game data needs it.  |
| `Client-Ip`     | Calls your server makes on a player's action (redeeming a promo code from a user panel): the player's IP. |

You do not send the tenant: it comes from the host and the API key. The reference page of each operation lists the
headers it reads; an operation of one game server answers `400 SERVER_SLUG_REQUIRED` without `Server-Slug` and
`404 SERVER_NOT_FOUND` for a server your tenant does not have. `Client-Ip` is honoured only from your server's addresses
registered with the platform; from any other address the platform uses the connection address. Ask [support](/support/)
to register them.

## Versioning

The major version is part of the path (`/v1/`). Within a version changes are backward compatible: new endpoints, new
optional parameters, new fields in responses. Ignore response fields you do not know. A breaking change ships as a new
version path.

## Requests and responses

- JSON in both directions, UTF-8, `Content-Type: application/json` on requests with a body.
- Times are ISO 8601 in UTC (`2026-10-12T09:33:20Z`), ids are UUIDs.
- A field without a value is `null`, never an empty string.

## Pagination

Lists are paginated in one of two ways; the reference states which one an endpoint uses.

- **Cursor feeds**: `after` (the id of the last item you have) and `limit`. An empty page means you reached the end;
  continue later from the same cursor. Example: the l2nx.top vote feed, `limit` 1 to 500, default 100.
- **Pages**: `page` (from 0) and `size`. Example: game data item templates, `size` up to 50. A larger `size` is silently
  reduced to the maximum, so rely on the returned page metadata, not on the requested size.

## Errors

Errors follow [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) and are returned as `application/problem+json`:

```json title="403 Forbidden"
{
  "type": "about:blank",
  "title": "Forbidden",
  "status": 403,
  "detail": "API key lacks a required scope",
  "code": "INSUFFICIENT_SCOPE",
  "traceId": "4f1c2a9b0d3e4f5a6b7c8d9e0f1a2b3c"
}
```

| Field     | Meaning                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `status`  | HTTP status, same as the response status.                                                                              |
| `detail`  | Human-readable explanation. Do not parse it: the text may change.                                                      |
| `code`    | Machine-readable reason in `UPPER_SNAKE_CASE`, for example `VALIDATION_FAILED`. Branch on it. Not every error has one. |
| `traceId` | Request id. Include it when you contact [support](/support/).                                                          |

Common statuses:

| Status | When                                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------- |
| `400`  | Invalid parameters or body.                                                                                    |
| `401`  | No API key, or the key is invalid. See [Authentication](/api/authentication/#errors).                          |
| `403`  | The key is known but not allowed: revoked, expired, missing scope, another tenant, tenant suspended or closed. |
| `404`  | The resource does not exist or does not belong to your tenant.                                                 |
| `429`  | Rate limit exceeded, see below.                                                                                |
| `5xx`  | Server-side failure. Retry with backoff.                                                                       |

## Rate limits

Requests are limited per API key and per scope. Unless the reference of an endpoint says otherwise, a key may send
bursts of up to 30 requests, refilled at 60 requests per minute.

Over the limit the API answers `429` with code `RATE_LIMITED` and a `Retry-After` header: the number of seconds to wait
before the next request. Wait at least that long; do not retry in a tight loop.

```http title="429 Too Many Requests"
HTTP/1.1 429 Too Many Requests
Retry-After: 2
Content-Type: application/problem+json

{"type":"about:blank","title":"Too Many Requests","status":429,"detail":"Too many requests","code":"RATE_LIMITED","traceId":"4f1c2a9b0d3e4f5a6b7c8d9e0f1a2b3c"}
```

Need a higher limit for a legitimate use case? Write to [support](/support/).
