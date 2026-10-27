---
title: Migration guide
description: Steps to upgrade the adapter across breaking changes.
---

This page lists the steps a host has to take when an adapter release breaks compatibility. Releases without an entry
here are drop-in: bump the version and restart.

## How breaking changes are announced

- Every module is versioned on its own (`core/v…`, `api/v…`, `db-sync/v…`), and every release appears in the
  [changelog](/adapter/changelog/) with its notes.
- A release that needs action from the host gets a section on this page, newest first: which module and version,
  what changed, and what to do.
- The documentation always describes the current version.

## nx-gs-adapter-api 0.122.0: private buy store slots in the runtime sync

**Breaking (source).** The canonical constructor of `CharacterRuntimeDto` takes a new last parameter,
`privateStoreBuySlots` (`Integer`): the maximum number of lines a private buy store of the character may hold right
now, independent of `privateStoreSellSlots`. A provider computes it from the same rules as the sell limit and passes
`null` when it does not report it. Code that builds `CharacterRuntimeDto` itself (providers, tests) adds the argument.

## nx-gs-adapter-api 0.120.0, nx-gs-adapter-core 0.51.0, nx-gs-gd-sync-core 0.16.0, nx-gs-db-migrations 0.5.0: command initiator, session checks, fishing gear

**Breaking.** Update the api, the core and gd-sync together and switch the host in one release.

- **Command initiator.** Every command carries a required `initiator` (`CommandInitiator`): who triggered it
  (`source` is `user` or the sending platform service; `userId` is set exactly for a user; optional `label`, `email`,
  `ip`). `NxCommand` has `getInitiator()`, and every command constructor and builder takes it. The core refuses a
  command without a valid initiator with `VALIDATION_FAILED` before your handler runs, and an `OwnerVerified` command
  also needs a user source, so a handler reads a valid initiator and never re-checks it. Its `ip` has already passed
  `ClientIdentifiers`. Code that builds commands itself (tests, tools) passes an initiator.
- **Removed `masterAccountId` and `initiatorIp`** from `StartOfflineFishingCommand`, `StopOfflineFishingCommand`,
  `ReviveCharacterCommand` and the private store start commands (`StartPrivateStoreCommand`), with no deprecated
  copy. Read `initiator.getUserId()` for the master account and `initiator.getIp()` for the request IP, and pass them
  on to `AppSessionStartRequest` as before. `BanCommand.issuedBy` and `SendCaptchaCommand.issuedBy` stay: they are the
  name the record shows in the game, not the attribution.
- **Package move.** `AppSessionStartRequest`, `AppSessionStartOutcome`, `ClientLoginOutcome`, `OfflineSession` and
  `OfflineSessionPlacement` moved from `app.l2nx.gs.adapter.api.spi.model` to
  `app.l2nx.gs.adapter.api.spi.model.session`. Replace the imports; nothing else changed in them.
- **Session checks.** `NxAppSessions.check(characterId, spotPool, spotId)` answers an `AppSessionCheckOutcome`
  (`ALLOWED`, `CHARACTER_BUSY` with the open session, `SPOT_TAKEN`, `UNAVAILABLE`) without writing anything, taking a
  spot or calling `OfflineSessionHost`. The new `CheckOfflineFishingCommand` (result `AppSessionCheckResult`) asks
  whether a fishing start with these inputs would start now: run your start steps up to the first side effect and
  call `check` where the start calls `start`. A refusal is a successful check (`OK`, `allowed = false`). Until you
  register a handler the adapter answers the command as unsupported. Code that implements `NxAppSessions` itself adds
  `check`.
- **New refusal vocabulary.** `AlreadyActiveScope.IP` (your per-IP limit, counted under `initiator.ip`; an absent IP
  limits nothing), and the `AppSessionRefusalReason` values
  `NO_FISHING_SHOT`, `INVALID_FISHING_SHOT` and `FISHING_SHOT_GRADE_MISMATCH` for the new optional
  `StartOfflineFishingCommand.fishingShotItemId`. A `DAILY_LIMIT` refusal may now carry `retryAt`, the moment your
  daily allowance resets; leave it out when your build does not know that moment.
- **`ActivityMetadataKey`** names the keys of an activity-usage row `metadata` (`elapsed`, `remaining`, `rodItemId`,
  `baitItemId`, `fishingShotItemId`, `spotPool`, `spotId`); write `key()` instead of your own strings. The map stays
  open.
- **Open-sessions snapshot.** The core publishes `AppSessionsSnapshotEvent` (the ids of every open app session of the
  server) every 60 s and when the app-sessions module starts, and republishes a session end until the platform has
  acknowledged it. Bump `nx-gs-db-migrations` to 0.5.0 with the core: its changesets add the column this needs.
- **Fishing gear catalog.** New game data providers `FishingBaitProvider`, `FishingRodProvider` and
  `FishingShotProvider` (entities `fishingbait`, `fishingrod`, `fishingshot`). Optional: a server without fishing
  registers none. A host that implements them registers each in `META-INF/services` and returns `null` from
  `snapshot()` until its data is loaded.
- **An empty game data snapshot now deletes.** A registered provider that returns an empty collection (or an empty
  `Optional` from `GearScoreRulesetProvider`) makes the platform delete every row of that entity for the server.
  Return `null` while your data is not loaded, never an empty collection.

## nx-gs-adapter-api 0.119.0: `clanId` and `allianceId` on chat messages

**Breaking for Java code only.** `ChatMetadataKeys.CLAN_ID` and `ChatMetadataKeys.ALLIANCE_ID` are removed, with no
deprecated copy. `ChatMessageEvent` now has the fields `clanId` and `allianceId` (`Long`, nullable) on every channel;
its constructor takes them as two new trailing parameters, and the builder has `clanId(...)` and `allianceId(...)`.

- A host that wrote the clan and alliance ids into the event `metadata` sets the two fields instead and stops writing
  those keys: the platform no longer reads them from `metadata`.
- The fields hold the speaker's clan and alliance at the moment of speaking. A message without a legal sender carries
  the addressee: on `CLAN` its clan and alliance, on `ALLIANCE` only the alliance. No clan or alliance means `null`.
- Code that calls the `ChatMessageEvent` constructor directly passes `null` for both new parameters, or the ids.

## nx-gs-adapter-api 0.119.0, nx-gs-adapter-core 0.50.0: revive of a dead character

Additive: a host that does not handle the new command needs no change. Until it does, the platform offers no revive for
the server (the published app settings carry no `revive` group), and an older host answers the command as any unknown
one.

- New `ReviveCharacterCommand` / `ReviveCharacterResult`: gets a dead character up at a restart point (`TOWN`), with the
  client connected or already closed. A host that wants the feature registers a handler for it and refuses with a
  `ReviveRefusalReason` code where the revive is not possible.
- New `AppRules` members `reviveEnabled()`, `reviveTownMode()` and `reviveTownSpotPools()`, and the keys
  `app.revive.enabled` (default `true`), `app.revive.town.mode` (`NATIVE` by default, or `SPOT_POOL`) and
  `app.revive.town.spot-pool`, see [configuration](/adapter/configuration/#app-settings-file). A server file without
  them keeps working. `AppSettings` gains a `revive` field; its public constructor takes it as a new parameter, so
  code that builds `AppSettings` itself passes `null` or a `ReviveSettings`.

## nx-gs-adapter-api 0.117.1, nx-gs-adapter-core 0.49.1: `LifeStoneGrade.JEWELRY`, `GameSettingsProvider`

**Breaking for Java code only.** The `LifeStoneGrade` constant `ACCESSORY` is now `JEWELRY` (neck, ear and finger
slots); no deprecated copy is kept. A host that builds life stone data replaces the constant, nothing else; the grade
is sent by name, so a host not yet updated keeps sending `ACCESSORY` until it is rebuilt.

Additive: the optional `GameSettingsProvider` (see [api](/adapter/modules/nx-gs-adapter-api/)) publishes the engine
configuration (enchant caps, attribute limits, mail fees, the offline private store fee). A host without it keeps
working and publishes no game settings; a host that implements it registers it in `META-INF/services` and returns
`null` from `gameSettings(...)` until its configuration is loaded. Two registered implementations fail the module.

## nx-gs-adapter-api 0.116.0, nx-gs-gd-sync-core 0.15.0: `StatModifier`, augmentation catalog

**Breaking for Java code only.** `SkillStatModifier` (package `app.l2nx.gs.adapter.api.kafka.sync.gd.skill.effect`)
is now `StatModifier` in `app.l2nx.gs.adapter.api.kafka.sync.gd`: skills and item options share it. Fields, getters,
builder and JSON are unchanged, and no deprecated copy is kept. A host that builds skill data replaces the import and
the class name, nothing else.

Additive: three new game data providers, `ItemOptionProvider`, `AugmentationTargetGroupProvider` and
`LifeStoneProvider` (entities `itemoption`, `augmentationtargetgroup`, `lifestone`). A host without them keeps working;
a host that implements them registers each in `META-INF/services` like the other providers and returns `null` from
`snapshot()` until its data is loaded. Update `nx-gs-gd-sync-core` together with the api, since it is the module that
publishes them.

## nx-gs-adapter-api 0.115.0, nx-gs-adapter-core 0.48.0: open sessions of a type, `APP_INTERRUPTED`

Additive: a host that uses neither addition needs no change.

- New `NxAppSessions.findOpen(ActivityType activity)`: every session of that type the adapter holds (running, awaiting
  the restore after a restart, a start in flight, an end still being written), ordered by `startedAt`, then id. It
  reads memory only, so any thread may call it; without a running session engine it answers an empty list. Call it
  right before `hostReady()` to count the sessions awaiting the restore against your per-account and per-device limits
  and to keep their spots (`OfflineSession.getSpotPool()`, `getSpotId()`) out of your free-spot pick.
- New end reason `LogoutReason.APP_INTERRUPTED`, accepted by `NxAppSessions.onActionEnded`: the game stopped the placed
  character's action (it was teleported, the tool or consumable the action needs vanished, the action failed to
  restart). Use it instead of `KICKED` (a staff kick) or `APP_STOPPED` (the player's stop). Send it only once the
  platform accepts it: a new reason reaches the adapter first, then the platform, then the host.

## nx-gs-adapter-api 0.114.0, nx-gs-adapter-core 0.47.0: default title of a placed character

`app.phantom.title.text` now defaults to `l2nx.app` instead of no title. A server file without the key shows
`l2nx.app` over characters the app placed in the world. To keep the character's own title, set the key to an empty
value (`app.phantom.title.text=`). No code change for hosts.

## nx-gs-adapter-api 0.112.0, nx-gs-adapter-core 0.46.0, nx-gs-db-migrations 0.4.0: private-store start cooldown

**What changed.** A private store started from the app can no longer be restarted right away to dump prices: a new
start of a character waits a few minutes after the real start of that character's previous app private store. The
adapter carries the rule and the data; the host enforces it.

- New key `app.private-store.start-cooldown-minutes` of `l2nx-app.properties` (default `5`, `0` turns the rule off,
  `0`-`1440`; see [configuration](/adapter/configuration/#app-settings-file)) and its typed value
  `AppRules.privateStoreStartCooldownMinutes()`.
- New `NxAppSessions.findLastStartedByCharacter(int characterId, ActivityType activity)`: the character's session of
  that type with the latest real start, open or closed. Same rules as the master-account read: starts that never
  really happened do not count.
- Renamed: `NxAppSessions.findLastStarted(UUID, ActivityType)` is now `findLastStartedByMasterAccount(UUID,
ActivityType)`; no deprecated copy is kept.
- Both reads complete the future exceptionally on a database failure and also while the adapter's session engine does
  not run (still booting, disabled, or not started). Before this release the master-account read answered an empty
  `Optional` in that case.
- New refusal token `PrivateStoreReason.COOLDOWN` (`INVALID_STATE`, with `retryAt`).
- The settings snapshot `AppSettings`: new `privateStoreStartCooldownMinutes`, and `startCooldownMinutes` is renamed to
  `fishingStartCooldownMinutes` (getter and builder method too). The constructor takes the new field, so code that
  builds `AppSettings` (tests included) uses the builder.
- New changeset `0010` of `nx-gs-db-migrations`: an index of the adapter's session table that serves the per-character
  read. The adapter applies it at start, like the earlier changesets.

**What to do.**

1. In every private-store start from the app (sell, package sell, buy), when
   `NxAppRules.current().privateStoreStartCooldownMinutes()` is above `0`, read
   `findLastStartedByCharacter(characterId, ActivityType.OFFLINE_PRIVATE_STORE)` and refuse the start with `COOLDOWN`
   and `retryAt` = its `startedAt` plus the cooldown while that moment is still ahead. Wait for the future on your
   command thread, never on the adapter IO pool.
2. A failed read refuses the start as temporarily unavailable, never as "no previous store".
3. Never apply the cooldown to a stop: closing a store is always allowed.
4. Rename calls of `findLastStarted(masterAccountId, activity)` to `findLastStartedByMasterAccount`, and uses of
   `AppSettings` `startCooldownMinutes` to `fishingStartCooldownMinutes`.
5. Upgrade `nx-gs-db-migrator-liquibase5` to 0.2.2: it brings `nx-gs-db-migrations` 0.4.0 (changeset 0010).

## nx-gs-adapter-api 0.111.0, nx-gs-adapter-core 0.45.0: app settings file

**What changed.** The adapter now owns the per-server app settings: the file `l2nx-app.properties` (see
[configuration](/adapter/configuration/#app-settings-file)), validated as a whole and reloaded without a restart.
The host no longer supplies or publishes settings. A host that implements `OfflineSessionHost` or calls
`NxAppSessions` must adapt in the same release that upgrades the api and the core:

- `OfflineSessionHost.settings()` is removed; delete the implementation.
- `OfflineSessionSettings` is removed. Its values are now keys of the file: return threshold, retention days, restore
  batch size and pause.
- `NxAppSessions.publishSettings` is removed: the adapter publishes the settings itself. Stop calling it and drop the
  host code that built `AppSettings`.
- `OfflineSession` has a new nullable `returnThresholdMs`, fixed at the session's start; the `returnToOrigin` flag of
  `removeFromWorld` is computed from it.
- New: `NxAppSessions.findOpenByMasterAccount` and `findLastStarted`, and `NxAppRules` (`NxAdapter.appRules()`,
  `ConnectContext.appRules()`, `CommandContext.appRules()`) for the typed rules.

**What to do.**

1. Remove `settings()` from your `OfflineSessionHost` and the calls to `publishSettings`.
2. Create `l2nx-app.properties` next to `l2nx.properties`, starting from the
   [reference file](https://github.com/l2nx/nx-gs-adapter/blob/master/l2nx-app.properties), and move your former
   settings values into it. Every session type is off by default: enable the ones the server offers.
3. Read the rules (cooldowns, durations, windows, spot pool) from `NxAppRules.current()` once per check instead of
   from your own configuration.
4. If you build `OfflineSession` yourself (tests included), pass the new `returnThresholdMs`.

The schema changes (a nullable column and an index on the adapter's session table) are applied by the adapter's
migrator at start.

## nx-gs-adapter-api 0.110.0: private-store contract

**What changed.** The private-store commands and events were reshaped. A host that handles `StartPrivateStore*`
commands, refuses a store start or purchase, or reads purchase events must adapt in the same release that upgrades
the api:

- A new `StartPrivateStoreBuyCommand` opens a buy store; its lines are `WantedLine` (`itemTemplateId`, `count`,
  `priceAdena`). `StartPrivateStoreSellCommand` and `StartPrivateStorePackageSellCommand` now extend the new
  `StartPrivateStoreSellingCommand`, which carries `getLines()` and `getSellerFeePercent()`; the common base
  `StartPrivateStoreCommand` no longer has them.
- `DroppedLine` takes a required `lineIndex` (0-based index into the command's `lines`), and its `itemId` is
  nullable.
- `PrivateStoreFees`, `MAX_FEE_PERCENT` and `BuyFromPrivateStoreCommand.MAX_LINES` are removed: limits are the
  platform's decision. A fee percent is validated only as not negative (seller fee also at most 100); refuse an
  oversized purchase with `TOO_MANY_LINES`.
- The `WellKnown*` private-store constant classes are replaced by the enums `PrivateStoreReason`,
  `DroppedLineReason` and `PrivateStoreMetadataKey`. `SellerFee` is now `PrivateStoreFee`, and
  `PrivateStoreMetadata` reads the seller and buyer fee from a purchase event's metadata.
- The purchase metadata `source` is now a `SessionSource` name, `CLIENT` or `APP` (it was `in_game` or `remote`).
- New lenient parsers return `null` for an unknown token: `SessionSource.fromToken` and the `fromToken` of the new
  enums.

**What to do.**

1. Replace the removed constants and classes with the enums and types above; take the `lines` of a sell command from
   `StartPrivateStoreSellingCommand`.
2. Fill `lineIndex` in every `DroppedLine` you report.
3. Send `CLIENT` or `APP` as the purchase `source`, and read it with `SessionSource.fromToken`.
4. Handle `StartPrivateStoreBuyCommand` to support buy stores.

## nx-gs-adapter-core 0.40.0: adapter-owned schema migrations

**What changed.** The adapter now creates and updates its own `l2nx_*` tables in the game database itself, before
any module starts. A game server without a schema migrator on the classpath goes `FAILED` at start.

**What to do** on a game server (a login server is not affected):

1. Run the server on Java 17 or newer.
2. Add [`nx-gs-db-migrator-liquibase5`](/adapter/modules/nx-gs-db-migrator-liquibase5/) and
   `org.liquibase:liquibase-core` 5.x to the runtime classpath, in the same release that upgrades the core.
3. Make sure exactly one `JdbcConnectionSource` is registered, and that its database user has write and DDL rights
   on the `l2nx_*` tables and `CREATE` in the schema.
4. Remove the host's own DDL for `l2nx_*` tables, if it had any: the adapter owns them now. An existing
   `l2nx_command_receipts` table is adopted as is, with its data.
5. If the host reads `l2nx_*` tables during its boot before `NxAdapter.start()`, call `NxAdapter.migrateSchema()`
   first.
