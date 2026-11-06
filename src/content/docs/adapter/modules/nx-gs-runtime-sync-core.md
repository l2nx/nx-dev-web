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
[maven-oss](https://artifacts.l2nx.online/service/rest/repository/browse/maven-oss/app/l2nx/nx-gs-runtime-sync-core/).

## When the host needs it

When the platform should show live state within seconds. It works next to
[`nx-gs-db-sync-core`](/adapter/modules/nx-gs-db-sync-core/) and does not replace it.

## What the host provides

One `RuntimeStateProvider` that returns the current in-memory rows of each runtime entity. The module does not touch
the database.

The host must also declare its start: call `NxAdapter.runtimeSync().hostStarted()` once, right after it publishes
`ServerStartedEvent`. Ticks start only when the module has started and that call has been made, so a host that never
makes it sends no runtime data. Until then the module stays `ACTIVE` with no entity stats.

## Configuration

`l2nx.runtime-sync.*` keys:
[configuration → nx-gs-runtime-sync-core](/adapter/configuration/#nx-gs-runtime-sync-core).
