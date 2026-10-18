---
title: Overview
description: How voting and the rating work on l2nx.top, from the point of view of a game server owner.
---

[l2nx.top](https://l2nx.top) is a Lineage 2 server rating and opening calendar. Players vote for projects there, and
you can reward them for it: every vote can carry your own player identifier and is delivered back to you.

## Projects and servers

A **project** is your whole game server brand: one site, one slug (`https://l2nx.top/{tenantSlug}`), one or more game
servers. Voting is per project. A vote may name one of your servers, but it always counts for the project.

Votes are accepted only while the project is listed on l2nx.top. A closed or hidden project, or a server that is not
listed, cannot receive votes.

## How a vote works

1. You send the player to your [vote link](/top/vote-link/): `https://l2nx.top/{tenantSlug}/vote`, usually with a `ref`
   that identifies the player on your side.
2. The player passes a Cloudflare Turnstile check and votes. Players do not need an account on l2nx.top.
3. The vote is recorded with your `ref` returned exactly as you sent it, and delivered to you:
   - pushed to your endpoint as the [`vote.created` webhook](/top/webhooks/), and
   - available in the vote feed of the [Integration API](/api/overview/) under your API key.
4. You match `ref` to the player and grant the reward.

:::note
l2nx.top does not interpret `ref`. It does not know your players and cannot check that the voter is the player the
`ref` points to. Decide on your side which votes earn a reward.
:::

## Cooldown

One vote per project every **24 hours** from the same voter. A voter is matched by:

- **network address**: the IPv4 address, or the `/64` network for IPv6;
- **browser**: a long-lived cookie set by l2nx.top.

A vote is rejected if a vote for the same project was cast in the last 24 hours from the same address **or** from the
same browser. The server chosen in the vote does not matter: one vote per project, not per server. The vote page
shows the player when the next vote becomes available.

Cooldowns are independent between projects: voting for another project does not affect yours.

:::caution
Players behind one public address (shared flat, internet café, mobile carrier NAT) share one cooldown. Do not promise
rewards to every account a person owns.
:::

## Rating

The l2nx.top rating is curated by published principles, not a raw vote count:

- votes on l2nx.top in the current calendar month (UTC);
- the project's presence and position on other Lineage 2 top sites;
- recent and upcoming server openings.

Weights are not published, and vote counts and scores are not shown to anyone. The rating is recalculated every hour
and the monthly vote count starts over at the beginning of each UTC month. An extra vote never counts against a
project.

Paid placements are shown in a separate block marked as sponsored. They buy visibility, not position: a promoted
project keeps its honest place in the rating.

Only you see your votes: the vote feed returns the votes of the project the API key belongs to.

## Next steps

- [Vote link](/top/vote-link/): build links for your site and game.
- [Webhooks](/top/webhooks/): receive `vote.created` and verify its signature.
- [Getting access](/top/getting-access/): request an API key and a webhook endpoint.
