---
title: Overview
description: What nx-l2 is, what it contains today and where it is heading.
---

L2NX Core is the open-source Lineage 2 server (repository `nx-l2`) built on [L2J Mobius](https://gitlab.com/MobiusDevelopment/L2J_Mobius), with
the L2NX platform integration built in. One repository holds every chronicle, the login server, the network stack and
the shared libraries.

Its game loop is the [Zero-Tick Engine](/core/zero-tick-engine/): the world reacts to events instead of ticking.

It serves three purposes:

- **A ready-made build.** Anyone who wants to run a server gets one, with L2NX integration out of the box. Without
  platform credentials it runs as a plain emulator.
- **A test bed for the adapter.** Every release of the [L2NX adapter](/adapter/overview/) is checked end to end against
  a live server.
- **Community development.** The engine is maintained in the open.

Like Mobius, nx-l2 is a reference implementation for education and research.

## Status

High Five is imported from L2J Mobius with its full history. Both servers run on Spring Boot (stage 2): metrics, health
checks, graceful shutdown and a Docker image. They store data in PostgreSQL, one schema per server, with the schema
managed by Liquibase (stage 3). See the [quick start](/core/quick-start/) and
[operations](/core/operations/).

| Stage | What it brings                                                               |
| ----- | ---------------------------------------------------------------------------- |
| 1     | High Five imported with history, Gradle build, local run                     |
| 2     | Spring Boot runtime: metrics, health checks, graceful shutdown               |
| 3     | PostgreSQL, schema managed by Liquibase                                      |
| 4     | Own Netty transport for every connection                                     |
| 5     | L2NX built in: the latest adapter, commands and events                       |
| 6     | Public test server                                                           |
| 7     | Movement, pathfinding and line of sight behind one interface, navmesh option |
| 8     | Newer clients on High Five                                                   |
| 9     | Essence, and the core both chronicles share                                  |
| 10    | Interlude                                                                    |

Every stage ends with a server that builds and a client that logs in and plays.

## Layout

The target layout; the repository has `libs/boot`, `libs/database`, `libs/gslink`, `libs/network`, `engine/core`,
`protocols/login/c621`, `login/`, `chronicles/high-five/` and `tools/load/`.

```
libs/          infrastructure with no Lineage 2 knowledge
engine/        mechanics shared by every chronicle
protocols/     one wire protocol each: opcodes, packet codecs, keys and frame cipher, shared by servers and load bots
login/         one login server for every chronicle
chronicles/    one self-contained directory per chronicle: server, scripts, datapack, boot
tools/         data preparation from the operator's own client; load/: the load harness
```

A chronicle keeps its code and its data in one directory, so the two change together. Quests, NPC behaviour and
handlers are a compiled module of their own, `scripts`, built against the chronicle's server.

## What the repository does not contain

No game client, no client assets, no geodata and no decompiled or leaked code. Operators prepare data from their own
client. See [licensing](/core/licensing/) for where the code comes from.
