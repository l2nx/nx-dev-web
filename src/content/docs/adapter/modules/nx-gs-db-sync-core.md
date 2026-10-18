---
title: nx-gs-db-sync-core
description: Database sync module — keeps the entities the host describes in sync on the platform.
sidebar:
  order: 3
---

Reads the game database and keeps the entities the host describes (characters, clans, items and others) in sync on
the platform. Each cycle compares row checksums with the previous cycle and publishes only inserted, changed and
deleted rows.

## Coordinates

```text
app.l2nx:nx-gs-db-sync-core
```

Java 8. Release tag `db-sync/vX.Y.Z`. Versions on
[Maven Central](https://central.sonatype.com/artifact/app.l2nx/nx-gs-db-sync-core).

## When the host needs it

When the platform should see the server's persisted game state. Put it on the runtime classpath; the core discovers
it on its own.

## What the host provides

- One `JdbcConnectionSource` wrapping the server's pool. The module only reads: it switches each borrowed connection
  to read-only, so `SELECT` on the game tables is enough for its part.
- One `DbSchemaProvider` that describes which tables and columns make up each entity. The schema differs between
  cores and builds, so it lives in the host.

The module keeps a snapshot cache on disk, so rows deleted while the server was down are reported after a restart.
Every server needs its own cache directory, see `l2nx.cdc-engine.persist.dir`.

## Configuration

`l2nx.cdc-engine.*` keys: [configuration → nx-gs-db-sync-core](/adapter/configuration/#nx-gs-db-sync-core).
