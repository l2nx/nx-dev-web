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
