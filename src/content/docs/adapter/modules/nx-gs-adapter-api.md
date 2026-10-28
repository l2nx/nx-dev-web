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
`LifeStoneProvider`, `FishingBaitProvider`, `FishingRodProvider`, `FishingShotProvider`.

Until its data is loaded a provider returns `null` from `snapshot()`. An empty collection (an empty `Optional` for
`GearScoreRulesetProvider`) means the catalog is empty, and the platform deletes every row of that entity for the
server.

The three fishing providers describe the gear the server accepts: every item it takes as a bait, a rod or a fishing
shot, with the chance, fishing time and grade its fishing uses for that item. A server without fishing registers
none.

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
`returnThresholdMs` it started with. The session types live in `app.l2nx.gs.adapter.api.spi.model.session`.

`NxAppSessions.check(characterId, spotPool, spotId)` is the check mode of a start: it runs the adapter's own start
checks (one open session per character, a free spot) and answers an `AppSessionCheckOutcome` (`ALLOWED`,
`CHARACTER_BUSY` with the open session, `SPOT_TAKEN`, `UNAVAILABLE`) without writing anything, taking a spot or
calling `OfflineSessionHost`. It backs the check commands (`CheckOfflineFishingCommand`): the host runs its start
steps up to the first side effect and calls `check` where the start calls `start`, so a check and a start never
answer differently.

Every command carries `initiator` (`CommandInitiator`): who triggered it, with the platform user, an optional label,
email and request IP. The core validates it before the handler runs; host rules read the master account from
`initiator.getUserId()` and the request IP from `initiator.getIp()`.

## Reviving a dead character

`ReviveCharacterCommand` asks the host to get a dead character up at a restart point (`TOWN` today, the game's "to
village"), with the client still connected or already closed; with `disconnectClient` a connected client is closed and
the character stays out of the game at the restart point. The host registers a handler like for any other command and
replies with `ReviveCharacterResult` (the restart point, where the character stands, whether a client was closed) or a
refusal whose reason is a `ReviveRefusalReason`. A retry with the same `idempotencyKey` answers the recorded result.
The settings come from `AppRules`: `reviveEnabled()`, `reviveTownMode()` (`ReviveTownMode.NATIVE` or `SPOT_POOL`) and
`reviveTownSpotPools()`; see [configuration](/adapter/configuration/#app-settings-file) for the `app.revive.*` keys.

## Chat with the app

Channels, metadata keys and audiences are enums whose names are the wire strings: `ChatChannel` (a channel a build
has but the enum does not name travels as `ChatChannel.unknownToken(rawType)`, `UNKNOWN_<int>`), `ChatMetadataKey`
(the map key is `key()`) and `ChatAudience`. A refusal of `SendChatMessageCommand` writes a
`SendChatMessageRefusalReason` name under `SendChatMessageRefusal.REASON`.

`AppRules.chatEnabled()` switches the chat with the app as a whole: off, the host publishes no game chat and refuses
every `SendChatMessageCommand` from a character with `CHAT_DISABLED`; a command without `senderCharacterId`
(an announcement, a line under a staff name) still goes out. `chatOnlineSendChannels()` and
`chatOfflineSendChannels()` (sets of `ChatChannel`, each `sendableFromApp()`, the offline one also
`sendableOffline()`) list where the app may send while the character is in game and out of it; the host picks the
list by the character's state when the command runs and refuses a channel outside it with `CHANNEL_DISABLED`.
`SendChatMessageCommand.offlineDelivery = false` asks the host to refuse a `WHISPER` to an addressee out of game with
`TARGET_OFFLINE` instead of delivering it to the app only; `null` reads as `true`. On every `WHISPER` the host sets
`SendChatMessageResult.targetInGame`: `true` when the packet went to the addressee's game client, `false` when the
message went to the app only. Such a whisper also carries `ChatMetadataKey.UNDELIVERED = "true"` in its
`ChatMessageEvent`. See [configuration](/adapter/configuration/#app-settings-file) for the `app.chat.*` keys.

## Configuration

No keys of its own.
