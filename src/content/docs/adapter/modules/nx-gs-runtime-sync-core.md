---
title: nx-gs-runtime-sync-core
description: Runtime sync module — publishes in-memory server state such as HP/MP/CP and coordinates.
sidebar:
  order: 4
---

Publishes state that lives only in server memory and reaches the database late or never: current HP/MP/CP,
coordinates, vitality. On every tick the module reads the state from the host, compares it with the previous tick
and publishes only the changes.

## Coordinates

```text
app.l2nx:nx-gs-runtime-sync-core
```

Java 8. Release tag `runtime-sync/vX.Y.Z`. Versions on
[Maven Central](https://central.sonatype.com/artifact/app.l2nx/nx-gs-runtime-sync-core).

## When the host needs it

When the platform should show live state within seconds. It works next to
[`nx-gs-db-sync-core`](/adapter/modules/nx-gs-db-sync-core/) and does not replace it.

## What the host provides

One `RuntimeStateProvider` that returns the current in-memory rows of each runtime entity. The module does not touch
the database.

## Configuration

`l2nx.runtime-sync.*` keys:
[configuration → nx-gs-runtime-sync-core](/adapter/configuration/#nx-gs-runtime-sync-core).
