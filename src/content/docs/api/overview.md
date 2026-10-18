---
title: Overview
description: 'The L2NX integration API for your site and tools: hosts, paths, versioning, pagination, errors and rate limits.'
---

The integration API is the HTTP API that your site, panel or bot calls server to server. Every request is made on
behalf of your project with its [API key](/api/authentication/).

## What is available

| Service   | What you can do                                               | Scope                          |
| --------- | ------------------------------------------------------------- | ------------------------------ |
| l2nx.top  | Read the vote feed, look votes up by `ref`                    | `top.votes:read`               |
| Game data | Read item templates of your game servers                      | `gamedata.item-templates:read` |
| Promo     | Redeem promo codes for players, for example from a user panel | `gameservers.promo:redeem`     |

Reference pages for each service are generated from its OpenAPI description and listed under **Integration API** in
the sidebar. They are updated automatically with every release of the service.

## Hosts and paths

Every service exposes the API under its own prefix:

```text
https://{host}/{service}/v{N}/integration/...
```

| Service             | Host                            | Example                                                                 |
| ------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| l2nx.top            | `https://api.l2nx.top`          | `https://api.l2nx.top/top/v1/integration/votes`                         |
| Project-scoped APIs | `https://{tenant}.api.l2nx.app` | `https://myproject.api.l2nx.app/gamedata/v1/integration/item-templates` |

On the project host `{tenant}` is your project slug. The project comes from the API key: a key works only on its own
project's host, a key of another project gets `403 API_KEY_TENANT_MISMATCH`.

Some endpoints need extra headers, for example the game server id for game data. The reference page of each
operation lists them.

## Versioning

The major version is part of the path (`/v1/`). Within a version changes are backward compatible: new endpoints,
new optional parameters, new fields in responses. Ignore response fields you do not know. A breaking change ships as a
new version path.

## Requests and responses

- JSON in both directions, UTF-8, `Content-Type: application/json` on requests with a body.
- Times are ISO 8601 in UTC (`2026-10-12T09:33:20Z`), ids are UUIDs.
- A field without a value is `null`, never an empty string.

## Pagination

Lists are paginated in one of two ways; the reference states which one an endpoint uses.

- **Cursor feeds**: `after` (the id of the last item you have) and `limit`. An empty page means you reached the end;
  continue later from the same cursor. Example: the l2nx.top vote feed, `limit` 1 to 500, default 100.
- **Pages**: `page` (from 0) and `size`. Example: game data item templates, `size` up to 50. A larger `size` is
  silently reduced to the maximum, so rely on the returned page metadata, not on the requested size.

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

| Status | When                                                                                   |
| ------ | -------------------------------------------------------------------------------------- |
| `400`  | Invalid parameters or body.                                                            |
| `401`  | No API key, or the key is invalid. See [Authentication](/api/authentication/#errors).  |
| `403`  | The key is known but not allowed: revoked, expired, missing scope, another project, project disabled. |
| `404`  | The resource does not exist or does not belong to your project.                        |
| `429`  | Rate limit exceeded, see below.                                                        |
| `5xx`  | Server-side failure. Retry with backoff.                                               |

## Rate limits

Requests are limited per API key and per scope. Unless the reference of an endpoint says otherwise, a key may send
bursts of up to 30 requests, refilled at 60 requests per minute.

Over the limit the API answers `429` with code `RATE_LIMITED` and a `Retry-After` header: the number of seconds to
wait before the next request. Wait at least that long; do not retry in a tight loop.

```http title="429 Too Many Requests"
HTTP/1.1 429 Too Many Requests
Retry-After: 2
Content-Type: application/problem+json

{"type":"about:blank","title":"Too Many Requests","status":429,"detail":"Too many requests","code":"RATE_LIMITED","traceId":"4f1c2a9b0d3e4f5a6b7c8d9e0f1a2b3c"}
```

Need a higher limit for a legitimate use case? Write to [support](/support/).
