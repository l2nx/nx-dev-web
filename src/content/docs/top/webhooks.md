---
title: Webhooks
description: Receive the vote.created webhook from l2nx.top, verify its signature and handle retries.
---

When a player votes for your project, l2nx.top sends a `vote.created` webhook to your endpoint. Webhooks follow
[Standard Webhooks](https://www.standardwebhooks.com/): an HTTPS `POST` with a JSON body, signed with HMAC-SHA256.

Your endpoint and its secret are set up on request: see [Getting access](/top/getting-access/).

## Endpoint requirements

- `https://` only, port 443, no user name or password in the URL.
- The host must resolve to public addresses only.
- Redirects are not followed: a `3xx` response counts as a failed attempt.
- Answer with any `2xx` within **10 seconds**. Everything else (another status, timeout, connection error) is a
  failed attempt and is retried.

## Request

```http title="Request"
POST /your/webhook/path HTTP/1.1
Content-Type: application/json
webhook-id: 0198f3c2-7b20-7c11-8e3f-2a9d4c6b1e05
webhook-timestamp: 1791797601
webhook-signature: v1,VoEoIgG2+YIaxaT1NlPXmryWL7s75ig5llw+xhf1tZw=

{"type":"vote.created","timestamp":"2026-10-12T09:33:20Z","data":{"id":"0198f3c2-7b1e-7a55-9d3a-5f6c1e2b4a10","tenantSlug":"myproject","serverSlug":"x100","ref":"5f0c6b2e9a8d4c1f","ip":"203.0.113.7","createdAt":"2026-10-12T09:33:20Z"}}
```

### Headers

| Header              | Meaning                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `webhook-id`        | Event id (UUID). The same on every retry of the same event: use it for deduplication.         |
| `webhook-timestamp` | Time of this delivery attempt, Unix seconds. Changes on every retry.                          |
| `webhook-signature` | Space-separated list of signatures `v1,<base64>`. Usually one, two while a secret is rotated. |

### Body

| Field       | Type   | Meaning                                                     |
| ----------- | ------ | ----------------------------------------------------------- |
| `type`      | string | Event type, `vote.created`. Ignore types you do not handle. |
| `timestamp` | string | When the vote was cast, ISO 8601 UTC.                       |
| `data`      | object | The vote, see below.                                        |

`data` of `vote.created`:

| Field        | Type           | Meaning                                                                      |
| ------------ | -------------- | ---------------------------------------------------------------------------- |
| `id`         | string (UUID)  | Vote id. Also the cursor of the vote feed.                                   |
| `tenantSlug` | string         | Your project slug at the time of the vote.                                   |
| `serverSlug` | string, `null` | The server the player picked; `null` if none.                                |
| `ref`        | string, `null` | The `ref` from your [vote link](/top/vote-link/), unchanged; `null` if none. |
| `ip`         | string         | Voter's IP address, IPv4 or IPv6. Always present in the webhook.             |
| `createdAt`  | string         | Vote time, ISO 8601 UTC. May contain fractional seconds.                     |

New fields may be added to the body and to `data` without a version change. Ignore fields you do not know.

## Retries

A failed attempt is retried on the Standard Webhooks schedule. Delays after the previous attempt:

| Attempt | 1   | 2   | 3     | 4      | 5   | 6   | 7    | 8    |
| ------- | --- | --- | ----- | ------ | --- | --- | ---- | ---- |
| Delay   | now | 5 s | 5 min | 30 min | 2 h | 5 h | 10 h | 10 h |

After 8 failed attempts (about 27 hours) the event is dropped. Use the [vote feed](#polling-the-vote-feed) to pick up
votes your endpoint missed.

## Handling events

- **Verify the signature first**, on the raw body, before parsing JSON. Reject an invalid request with `401`.
- **Deduplicate.** The same event can arrive more than once (a retry after a timeout on your side, for example). Store
  `webhook-id` and skip events you have already processed. If you also poll the feed, deduplicate rewards by vote
  `data.id`: the feed returns the same id.
- **Do not rely on order.** Retries can deliver an older event after a newer one.
- **Answer fast.** Put the event into your own queue or table and return `2xx`; grant rewards asynchronously.

## Verifying the signature

1. Take the secret, drop the `whsec_` prefix and base64-decode the rest: these bytes are the HMAC key.
2. Build the signed content: `{webhook-id}.{webhook-timestamp}.{raw body}`.
3. Compute HMAC-SHA256 of it and encode the result in base64.
4. Split `webhook-signature` by spaces. The request is valid if any `v1,` entry equals your value. Compare in constant
   time.
5. Reject the request if `webhook-timestamp` is more than 5 minutes away from your clock. This blocks replays of
   captured requests; keep your server clock in sync.

:::caution
Verify the signature against the body exactly as received. A framework that parses and re-serializes JSON changes
the bytes, and the signature no longer matches.
:::

Any [Standard Webhooks library](https://github.com/standard-webhooks/standard-webhooks) does the same check. The
examples below use only the standard library of each language.

### Java

Java 8 or later, no dependencies.

```java title="L2nxWebhookVerifier.java"
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class L2nxWebhookVerifier {

    private static final long TOLERANCE_SECONDS = 5 * 60;
    private static final String SECRET_PREFIX = "whsec_";

    private final byte[] key;

    public L2nxWebhookVerifier(String secret) {
        String encoded = secret.startsWith(SECRET_PREFIX) ? secret.substring(SECRET_PREFIX.length()) : secret;
        this.key = Base64.getDecoder().decode(encoded);
    }

    /** {@code body} must be the raw request body, byte for byte. */
    public boolean verify(String id, String timestamp, String signatureHeader, byte[] body)
            throws GeneralSecurityException {
        long sentAt;
        try {
            sentAt = Long.parseLong(timestamp);
        } catch (NumberFormatException e) {
            return false;
        }
        if (Math.abs(System.currentTimeMillis() / 1000 - sentAt) > TOLERANCE_SECONDS) {
            return false;
        }
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        mac.update((id + "." + timestamp + ".").getBytes(StandardCharsets.UTF_8));
        byte[] expected = Base64.getEncoder().encode(mac.doFinal(body));
        for (String entry : signatureHeader.split(" ")) {
            if (entry.startsWith("v1,")
                    && MessageDigest.isEqual(expected, entry.substring(3).getBytes(StandardCharsets.US_ASCII))) {
                return true;
            }
        }
        return false;
    }
}
```

With Spring MVC, read the body as `byte[]` so it is not re-serialized:

```java title="L2nxWebhookController.java"
import java.security.GeneralSecurityException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class L2nxWebhookController {

    private final L2nxWebhookVerifier verifier = new L2nxWebhookVerifier(System.getenv("L2NX_WEBHOOK_SECRET"));

    @PostMapping("/l2nx/webhook")
    public ResponseEntity<Void> receive(
            @RequestHeader("webhook-id") String id,
            @RequestHeader("webhook-timestamp") String timestamp,
            @RequestHeader("webhook-signature") String signature,
            @RequestBody byte[] body)
            throws GeneralSecurityException {
        if (!verifier.verify(id, timestamp, signature, body)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        // Deduplicate by id, store the event, grant the reward asynchronously.
        return ResponseEntity.noContent().build();
    }
}
```

### PHP

PHP 7.4 or later, no extensions beyond the default ones.

```php title="l2nx-webhook.php"
<?php

function l2nx_verify_webhook(string $secret, string $id, string $timestamp, string $signatureHeader, string $body): bool
{
    if (preg_match('/^\d+$/', $timestamp) !== 1 || abs(time() - (int) $timestamp) > 300) {
        return false;
    }
    $key = base64_decode(preg_replace('/^whsec_/', '', $secret), true);
    if ($key === false) {
        throw new InvalidArgumentException('Malformed webhook secret');
    }
    $expected = base64_encode(hash_hmac('sha256', $id . '.' . $timestamp . '.' . $body, $key, true));
    foreach (explode(' ', $signatureHeader) as $entry) {
        $parts = explode(',', $entry, 2);
        if (count($parts) === 2 && $parts[0] === 'v1' && hash_equals($expected, $parts[1])) {
            return true;
        }
    }
    return false;
}

$body = file_get_contents('php://input');
$id = $_SERVER['HTTP_WEBHOOK_ID'] ?? null;
$timestamp = $_SERVER['HTTP_WEBHOOK_TIMESTAMP'] ?? null;
$signature = $_SERVER['HTTP_WEBHOOK_SIGNATURE'] ?? null;

if ($id === null || $timestamp === null || $signature === null
    || !l2nx_verify_webhook(getenv('L2NX_WEBHOOK_SECRET'), $id, $timestamp, $signature, $body)) {
    http_response_code(401);
    exit;
}

$event = json_decode($body, true);
// Deduplicate by $id, store $event, grant the reward asynchronously.
http_response_code(204);
```

### Node.js

Node.js 18 or later, no dependencies.

```js title="l2nx-webhook.mjs"
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const TOLERANCE_SECONDS = 5 * 60;

export function verifyL2nxWebhook(
  secret,
  id,
  timestamp,
  signatureHeader,
  body,
) {
  if (
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS
  ) {
    return false;
  }
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = Buffer.from(
    createHmac("sha256", key)
      .update(`${id}.${timestamp}.`)
      .update(body)
      .digest("base64"),
  );
  return signatureHeader.split(" ").some((entry) => {
    if (!entry.startsWith("v1,")) {
      return false;
    }
    const candidate = Buffer.from(entry.slice(3));
    return (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    );
  });
}

createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const id = req.headers["webhook-id"];
    const timestamp = req.headers["webhook-timestamp"];
    const signature = req.headers["webhook-signature"];
    if (
      !id ||
      !timestamp ||
      !signature ||
      !verifyL2nxWebhook(
        process.env.L2NX_WEBHOOK_SECRET,
        id,
        timestamp,
        signature,
        body,
      )
    ) {
      res.writeHead(401).end();
      return;
    }
    const event = JSON.parse(body.toString("utf8"));
    // Deduplicate by id, store the event, grant the reward asynchronously.
    res.writeHead(204).end();
  });
}).listen(8080);
```

Run it behind your HTTPS reverse proxy: l2nx.top delivers to port 443 only.

### Testing your code

The [request above](#request) is signed with the test secret `whsec_1UzhPzSh1U6v5xtuugrtt52qBlyyyGi396CrL5mcBJQ=`.
Feed your verifier its `webhook-id`, `webhook-timestamp`, `webhook-signature` and the body (one line, no trailing
newline): it must accept the request once the 5-minute check is disabled for the test, and reject it if any byte of
the body changes.

## Secret rotation

When the secret is rotated, the old and the new secret both sign deliveries for 24 hours, so `webhook-signature`
carries two entries. Switch your endpoint to the new secret within that window. The examples above already accept
any matching entry.

## Polling the vote feed

Webhooks are the fast path. The vote feed of the [Integration API](/api/overview/) is the source to catch up from:
after downtime on your side, or after an event ran out of retries.

- `GET https://api.l2nx.top/top/v1/integration/votes?after={voteId}&limit={1..500}` returns `{"votes": [...]}`: votes
  of your project in id order, starting after `after` (from the oldest vote without it). `limit` defaults to 100. An
  empty list means you reached the end: poll again later with the id of the last vote you saw.
- `POST https://api.l2nx.top/top/v1/integration/votes/lookup` with `{"refs": [...]}` (1 to 500 values) returns all
  votes carrying any of these `ref` values. A `ref` without a vote is simply absent.

Feed votes have the same fields as webhook `data`. The feed shows a vote about 10 seconds after it is cast, and `ip`
becomes `null` once a vote is older than 90 days.

Both calls need an API key with the `top.votes:read` scope: see [Authentication](/api/authentication/).
