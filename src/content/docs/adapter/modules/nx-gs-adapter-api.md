---
title: nx-gs-adapter-api
description: Contracts and SPI shared by the host, the adapter modules and the platform.
sidebar:
  order: 2
---

Contracts of the adapter: the data it sends to the platform and the service provider interfaces (SPI) that the host
and the modules implement. The host compiles its integration against this artifact.

## Coordinates

```text
app.l2nx:nx-gs-adapter-api
```

Java 8. Release tag `api/vX.Y.Z`. Versions on
[Maven Central](https://central.sonatype.com/artifact/app.l2nx/nx-gs-adapter-api).

## When the host needs it

Always: it comes transitively with [`nx-gs-adapter-core`](/adapter/modules/nx-gs-adapter-core/). Keep it at the
version the core declares.

## What the host implements

Every provider is registered in `META-INF/services/<interface name>` and discovered through `ServiceLoader`. The
interfaces live in `app.l2nx.gs.adapter.api.spi.provider`.

| Provider                    | Read by                                                                                           | Required                          |
| --------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------- |
| `JdbcConnectionSource`      | core, [db-sync](/adapter/modules/nx-gs-db-sync-core/)                                             | exactly one on a game server      |
| `SchemaMigrator`            | core; shipped in [`nx-gs-db-migrator-liquibase5`](/adapter/modules/nx-gs-db-migrator-liquibase5/) | exactly one on a game server      |
| `DbSchemaProvider`          | [db-sync](/adapter/modules/nx-gs-db-sync-core/)                                                   | with db-sync                      |
| `RuntimeStateProvider`      | [runtime-sync](/adapter/modules/nx-gs-runtime-sync-core/)                                         | with runtime-sync                 |
| Game data providers (below) | [gd-sync](/adapter/modules/nx-gs-gd-sync-core/)                                                   | one per catalog the server offers |
| `GameDataReadinessProvider` | [gd-sync](/adapter/modules/nx-gs-gd-sync-core/)                                                   | no                                |
| `OfflineSessionHost`        | core (app sessions)                                                                               | no                                |
| `GameSettingsProvider`      | core (settings sync)                                                                              | no                                |

Game data providers: `ItemTemplateProvider`, `NpcTemplateProvider`, `SkillProvider`, `RecipeTemplateProvider`,
`ArmorSetTemplateProvider`, `SoulCrystalTemplateProvider`, `ExperienceLevelProvider`, `ClassTemplateProvider`,
`InstanceTemplateProvider`, `GearScoreRulesetProvider`, `ItemOptionProvider`, `AugmentationTargetGroupProvider`,
`LifeStoneProvider`.

The three augmentation providers describe the catalog the server rolls from: every item option the engine loaded
(augmentation and enchant options share one id space), the groups of item templates that roll the same way, and each
life stone with the groups it accepts and the probability of every option per slot. The server computes those
probabilities with its own roll code; the platform stores them as they are.

`GameSettingsProvider` gives the engine configuration as the engine applies it (enchant caps, attribute limits, mail
fees, the offline private store fee), so the platform shows the server's rules to the player. The adapter calls it
from its IO threads on connect and every 5 minutes; the provider builds the snapshot from the live configuration on
every call, so a reloaded configuration reaches the platform within one period. `null` means the host is not ready
yet; a call that throws is logged once per failure streak and retried on the next period.

Modules implement `app.l2nx.gs.adapter.api.spi.AdapterModule` (a public class with a public no-argument
constructor). At connect a module receives a `ConnectContext` with the adapter's capabilities: events, commands, sync
triggers, game data and the IO pool. A host that publishes events or handles platform commands does it from its own
`AdapterModule`. A module that throws goes `FAILED`; the other modules keep running.

## App sessions and app settings

`OfflineSessionHost` carries only the world side of an app session (place, restore and remove the character). The
rules come from the [app settings file](/adapter/configuration/#app-settings-file) through `NxAppRules`, whose
`current()` returns an immutable `AppRules` snapshot; `ConnectContext.appRules()` and `CommandContext.appRules()` give
the same instance. `NxAppSessions` gives the host three reads for its start rules: the open sessions of a master
account (`findOpenByMasterAccount`, in memory) for the one-session-per-account check, the latest started session of a
master account (`findLastStartedByMasterAccount`, a database read) for the fishing start cooldown, and the latest
started session of a character (`findLastStartedByCharacter`, a database read) for the private-store start cooldown
only. A failed database read completes its future exceptionally; the host refuses the start as temporarily
unavailable. `findOpen` (in memory) lists every open session of a type, those awaiting the restore included: the host
calls it right before `hostReady()` to reserve their limits and spots. Every `OfflineSession` carries the
`returnThresholdMs` it started with.

## Configuration

No keys of its own.
