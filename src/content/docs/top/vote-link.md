---
title: Vote link
description: Build l2nx.top vote links with a player reference and a preselected server.
---

## Format

```text
https://l2nx.top/{tenantSlug}/vote?ref={ref}&server={serverSlug}
```

| Part         | Required | Meaning                                                                                |
| ------------ | -------- | -------------------------------------------------------------------------------------- |
| `tenantSlug` | yes      | Your project slug, the same as in `https://l2nx.top/{tenantSlug}`.                     |
| `ref`        | no       | Your identifier for this vote. Returned unchanged in the webhook and the feed.         |
| `server`     | no       | Slug of one of your servers. Preselects it on the vote page; the player can change it. |

Both query parameters are optional. A link without `ref` still counts for the rating, but you cannot tell who voted.

The link without a language opens the page in the player's language. To force one, add it to the path:
`https://l2nx.top/en/{tenantSlug}/vote`, `/ru/`, `/uk/` or `/es/`. Query parameters are kept.

If your project slug changes, old links redirect to the new address together with `ref` and `server`.

## What to put in `ref`

`ref` is an opaque string: l2nx.top stores it and gives it back, nothing else.

- Up to **128 characters**, no control characters. A longer `ref` makes the vote fail. Stick to `A-Z a-z 0-9 - _`
  so the value needs no URL encoding.
- Not trimmed or changed. An empty `ref` is treated as no `ref`.
- **Stable and yours.** It must let you find the player when the vote comes back.

The recommended pattern is a **vote attempt id**: when a player asks to vote, generate a random id (for example a
UUID), store it with the player's account, and put it in `ref`. When the vote arrives, look the id up and reward the
account once.

This beats putting the account id in the link directly:

- the player sees and can edit the link: a random id cannot be guessed, an account id can be swapped for someone
  else's;
- you can reject `ref` values you never issued and attempts that were already rewarded.

:::caution
The link is visible to the player, in browser history and in l2nx.top data. Never put e-mail addresses, logins,
character names, passwords, session tokens or any other personal or secret data into `ref`.
:::

## On your site

Generate the link on your server for the signed-in player, then show it as a button.

```php title="vote-link.php"
<?php
// $attemptId: random id stored with the player's account, e.g. bin2hex(random_bytes(16))
$link = 'https://l2nx.top/myproject/vote?' . http_build_query([
    'ref' => $attemptId,
    'server' => 'x100',
]);
?>
<a href="<?= htmlspecialchars($link) ?>" target="_blank" rel="noopener">Vote for us on l2nx.top</a>
```

```js title="vote-link.js"
// attemptId: random id stored with the player's account, e.g. crypto.randomUUID()
const link = new URL("https://l2nx.top/myproject/vote");
link.searchParams.set("ref", attemptId);
link.searchParams.set("server", "x100");
```

A link without a player, for a banner or a public page:

```html title="banner.html"
<a href="https://l2nx.top/myproject/vote" target="_blank" rel="noopener"
  >Vote for us on l2nx.top</a
>
```

## In game

Players vote in a browser, so the game only has to show them a personal link. Typical options:

- a vote button in your Community Board or an NPC dialog that opens your site's vote page;
- a chat command that creates an attempt and prints the personal link.

Create the attempt on your side at that moment, exactly as on the site, and reward on the incoming vote.

## Getting the vote back

- [Webhooks](/top/webhooks/): l2nx.top pushes every vote to your endpoint, usually within seconds.
- Vote feed: poll the [Integration API](/api/overview/) for votes you might have missed.

The webhook endpoint and the API key for the feed are set up on request: see
[Getting access](/top/getting-access/).
