---
title: Getting access
description: How to get a tenant, a platform URL and server keys for the L2NX adapter.
---

To connect a server, a project needs a tenant on the L2NX platform and a server key for each server. Both are issued
on request; there is no self-service sign-up yet.

## How to request

Email [support@l2nx.app](mailto:support@l2nx.app) and include:

- **Project name** as players know it.
- **Project site** URL.
- **Server list**: the name of each game server you want to connect, and the login server if you connect one.

## What you receive

- **Platform URL** of your tenant, for example `https://<tenant>.api.l2nx.app`. It goes into `l2nx.platform-url`.
- **Server key** for each server, a string that starts with `nx_sk_` and is 38 characters long. It goes into
  `l2nx.gs-key` (or `l2nx.ls-key` for a login server).

Then follow the [quick start](/adapter/quick-start/).

:::caution
The server key authenticates your server on the platform. Do not commit it to a repository or share it. If a key
leaks, contact support right away.
:::
