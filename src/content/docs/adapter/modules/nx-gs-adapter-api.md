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

Game data providers: `ItemTemplateProvider`, `NpcTemplateProvider`, `SkillProvider`, `RecipeTemplateProvider`,
`ArmorSetTemplateProvider`, `SoulCrystalTemplateProvider`, `ExperienceLevelProvider`, `ClassTemplateProvider`,
`InstanceTemplateProvider`, `GearScoreRulesetProvider`.

Modules implement `app.l2nx.gs.adapter.api.spi.AdapterModule` (a public class with a public no-argument
constructor). At connect a module receives a `ConnectContext` with the adapter's capabilities: events, commands, sync
triggers, game data and the IO pool. A host that publishes events or handles platform commands does it from its own
`AdapterModule`. A module that throws goes `FAILED`; the other modules keep running.

## Configuration

No keys of its own.
