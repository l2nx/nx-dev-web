---
title: Getting access
description: Request an API key and a webhook endpoint for l2nx.top votes.
---

The [vote link](/top/vote-link/) works for any listed project without any setup. To get votes back you need one or
both of:

- a **webhook endpoint** that receives [`vote.created`](/top/webhooks/);
- an **API key** with the `top.votes:read` scope for the vote feed and lookup (see
  [Authentication](/api/authentication/)).

Until the project owner cabinet is available, both are set up on request.

## How to request

Write to [support@l2nx.app](mailto:support@l2nx.app) and include:

- the project: its l2nx.top page (`https://l2nx.top/{tenantSlug}`) or site address;
- what you need: webhook, API key, or both;
- for the webhook: the endpoint URL (`https://`, port 443, publicly reachable; see
  [endpoint requirements](/top/webhooks/#endpoint-requirements));
- for the API key: a name for it (for example, `site-production`) and an expiry date if you want one;
- a technical contact for delivery problems.

If you do not know the slugs of your project or servers for [vote links](/top/vote-link/), ask in the same message.
Support may ask you to confirm that you own the project.

## What you get

- **Webhook secret** `whsec_…`, used to [verify signatures](/top/webhooks/#verifying-the-signature).
- **API key** `nx_api_…`.

Both are shown once. Store them in your server configuration or secret store, never in client-side code, the game
client or a public repository.

## Changes and rotation

Write to the same address to:

- **change the webhook URL**: the secret stays the same;
- **rotate the webhook secret**: for 24 hours deliveries are signed with both the old and the new secret, so you can
  switch without losing events;
- **replace an API key**: a new key is issued while the old one keeps working; revoke the old key once you have
  switched;
- **revoke a key** that may have leaked: write at once.

A project can have several active API keys, for example one per environment.
