---
title: nx-gs-gd-sync-core
description: Game data sync module — publishes the parsed datapack as catalogs for the wiki, market and gear score.
sidebar:
  order: 5
---

Publishes the game data the server has parsed from its datapack: item, NPC, skill, recipe, armor set, soul crystal,
class and instance templates, item options with the augmentation catalog (life stones and target groups),
experience levels and the gear score ruleset. The platform uses them as catalogs for
the wiki, the market and gear score. The module publishes what the server holds in memory after its own overrides,
so the catalog matches the game.

## Coordinates

```text
app.l2nx:nx-gs-gd-sync-core
```

Java 8. Release tag `gd-sync/vX.Y.Z`. Versions on
[Maven Central](https://central.sonatype.com/artifact/app.l2nx/nx-gs-gd-sync-core).

## When the host needs it

When the server's items, NPCs and skills should appear on the platform exactly as they are in the game.

## What the host provides

- A provider for each catalog it offers (see the list in
  [`nx-gs-adapter-api`](/adapter/modules/nx-gs-adapter-api/#what-the-host-implements)). A catalog without a provider
  is not published.
- Optionally a `GameDataReadinessProvider` that reports when the datapack has finished loading. Without it the module
  treats the data as ready at once; with it the module waits, so a snapshot is never taken from half-loaded data.
- A call to `NxGameData.publishSnapshot()` after the server reloads its datapack, so the platform gets the new data
  at once. A host module gets `NxGameData` from `ConnectContext.gameData()`.

The module publishes the first snapshot on its own after the connect. The platform can also request a full
republish, and `l2nx.gd-sync.resync-interval-hours` adds a periodic one.

## Configuration

[configuration → nx-gs-gd-sync-core](/adapter/configuration/#nx-gs-gd-sync-core).
