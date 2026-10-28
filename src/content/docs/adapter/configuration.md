---
title: Configuration
description: Every l2nx.* configuration key of the adapter and its modules, with types, defaults and meaning.
---

All adapter modules read their keys from one source chain, key by key:

1. The file given by the JVM system property `-Dl2nx.config-file=<path>`; otherwise `l2nx.properties` in the JVM
   working directory.
2. JVM system properties `-Dl2nx.<key>=<value>`, only for keys the file does not set.

Environment variables are not supported. Details on the file lookup are in the
[quick start](/adapter/quick-start/#5-create-l2nxproperties).

Rules for values:

- The file is read as UTF-8. Values are trimmed; an empty value counts as not set and the default applies.
- Keys are read once at start. A change takes effect after a server restart. The only exception is the separate
  [app settings file](#app-settings-file), which reloads while the server runs.
- An invalid value (not a number, out of range, unknown option) never falls back to the default: the adapter logs
  an error naming the key, and the part that reads it does not start. For core keys the adapter goes `FAILED`.
- Booleans are `true` or `false`, enumerations are case-insensitive.
- `cores` in the defaults below is the number of processors available to the JVM.

## nx-gs-adapter-core

### Connection

| Key                 | Type      | Default | Required | Meaning                                                                                                                                                                         |
| ------------------- | --------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `l2nx.config-file`  | path      | not set | no       | Path to the properties file. Read only as a JVM system property. Set but unreadable: the adapter fails at start.                                                                |
| `l2nx.enabled`      | boolean   | `false` | no       | Master switch. With `false` the adapter goes `DISABLED`: no connect, no heartbeat, no sync.                                                                                     |
| `l2nx.platform-url` | URL       | —       | yes      | Base URL of your tenant on the platform, for example `https://<tenant>.api.l2nx.app`. Must be `https` with a host and without a query or fragment; a trailing slash is dropped. |
| `l2nx.host-type`    | `gs`/`ls` | `gs`    | no       | What the adapter runs in: `gs` for a game server, `ls` for a login server. Decides which key below is read.                                                                     |
| `l2nx.gs-key`       | string    | —       | for `gs` | Server key of the game server: starts with `nx_sk_`, 38 characters in total. Must not be set together with `l2nx.ls-key`.                                                       |
| `l2nx.ls-key`       | string    | —       | for `ls` | Server key of the login server, same format as `l2nx.gs-key`. Must not be set together with `l2nx.gs-key`.                                                                      |

### IO pool

| Key               | Type | Default           | Required | Meaning                                                                                                                        |
| ----------------- | ---- | ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `l2nx.io.workers` | int  | `max(2, cores/2)` | no       | Size of the adapter's pool for blocking work of modules and command handlers (JDBC, HTTP). Threads are named `nx-io-N`. `≥ 1`. |

### Kafka producer

The adapter publishes through a Kafka producer whose connection and security settings come from the platform. These
three settings can be tuned:

| Key                                    | Type   | Default | Required | Meaning                                                                                                                                                       |
| -------------------------------------- | ------ | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `l2nx.kafka.producer.batch.size`       | bytes  | `16384` | no       | Producer batch size. Larger means fewer round trips and faster bulk syncs, smaller means lower latency.                                                       |
| `l2nx.kafka.producer.linger.ms`        | ms     | `10`    | no       | How long the producer waits to fill a batch. Higher values cut round trips on large initial syncs, `0` gives the lowest latency.                              |
| `l2nx.kafka.producer.compression.type` | string | `gzip`  | no       | Batch compression: `none`, `gzip`, `lz4`, `snappy` or `zstd`. `gzip` needs nothing extra; `lz4`, `snappy` and `zstd` need their library JAR on the classpath. |

### Events

Events the host publishes go through one bounded queue drained by one thread.

| Key                                     | Type              | Default  | Required | Meaning                                                                                                                                                                                                     |
| --------------------------------------- | ----------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `l2nx.events.queue-capacity`            | int               | `10000`  | no       | Maximum queued events. Lower uses less heap but drops more on bursts. `≥ 1`.                                                                                                                                |
| `l2nx.events.drop-policy`               | `newest`/`oldest` | `newest` | no       | What happens when the queue is full. `newest` drops the incoming event and keeps the queue order (recommended); `oldest` evicts the oldest queued event, for when freshness matters more than completeness. |
| `l2nx.events.shutdown-drain-timeout-ms` | ms                | `5000`   | no       | How long the adapter keeps delivering queued events after shutdown starts; what is left is dropped and counted. Raise it if events get lost at shutdown. `≥ 0`.                                             |

### Commands

Commands from the platform are dispatched to the handlers the host registers. Offsets are committed per batch, so
a batch that was not committed is delivered again after a restart: handlers must be idempotent.

| Key                                   | Type   | Default  | Required | Meaning                                                                                                                                                                                                                                                                                                |
| ------------------------------------- | ------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `l2nx.commands.poll-timeout-ms`       | ms     | `100`    | no       | How long each poll for new commands blocks. Lower means faster shutdown and more idle wakeups. `≥ 1`.                                                                                                                                                                                                  |
| `l2nx.commands.shutdown-timeout-ms`   | ms     | `5000`   | no       | How long shutdown waits for running handlers. Commands not dispatched by then are delivered again on the next start. `≥ 0`.                                                                                                                                                                            |
| `l2nx.commands.host-sync-timeout-ms`  | ms     | `30000`  | no       | Limit on a handler's synchronous call into the game side through the host executor. On expiry the command ends with `UNAVAILABLE`. Keeps a saturated game pool from stalling the commands consumer. `≥ 1`.                                                                                             |
| `l2nx.commands.deferred-reply-max-ms` | ms     | `300000` | no       | Limit on a deferred reply: a handler that deferred its reply and never completed it gets `INTERNAL_ERROR`. Must exceed the longest legitimate deferred command on the server. `≥ 1`.                                                                                                                   |
| `l2nx.commands.kafka.<property>`      | string | —        | no       | Passed as is to the Kafka consumer of commands as `<property>`. Defaults `max.poll.records=50` and `auto.offset.reset=earliest` can be overridden this way; `bootstrap.servers`, `client.id`, `group.id`, `enable.auto.commit`, `security.protocol` and `sasl.*` are pinned by the adapter and cannot. |

## nx-gs-db-sync-core

The database sync engine (`l2nx.cdc-engine.*`). The defaults are sized for an items table of about 12 million rows.

| Key                                                       | Type | Default                          | Required | Meaning                                                                                                                                                                                                              |
| --------------------------------------------------------- | ---- | -------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `l2nx.cdc-engine.tick-interval-seconds`                   | s    | `60`                             | no       | Period between sync cycles of each entity. Lower means fresher data and more database load. `≥ 1`.                                                                                                                   |
| `l2nx.cdc-engine.rows-per-window`                         | int  | `500000`                         | no       | Rows read per query window; larger entities are read in several windows. Higher speeds up the initial sync but holds reads longer and needs more heap. `1` to `10000000`.                                            |
| `l2nx.cdc-engine.query-timeout-seconds`                   | s    | `10`                             | no       | JDBC timeout of each query. A window that times out is aborted and retried on the next cycle. Raise it for large tables on slow disks. `≥ 1`.                                                                        |
| `l2nx.cdc-engine.publish-flush-seconds`                   | s    | `5`                              | no       | How long the end of a cycle waits for publish confirmations. Unconfirmed rows are published again in the next cycle. Raise it on `publishes still pending` warnings. `≥ 1`.                                          |
| `l2nx.cdc-engine.workers`                                 | int  | `max(2, min(entities, cores/2))` | no       | Size of the shared engine pool. `0` means the default formula.                                                                                                                                                       |
| `l2nx.cdc-engine.fetch-size`                              | int  | `10000`                          | no       | JDBC fetch size hint. Ignored on MySQL Connector/J (the adapter streams rows there); MariaDB uses it as a cursor batch only with `useCursorFetch=true` in the URL; other drivers take it as the cursor batch. `≥ 1`. |
| `l2nx.cdc-engine.persist.dir`                             | path | `nx-cdc-snapshot`                | no       | Directory of the on-disk snapshot cache, relative to the JVM working directory unless absolute. See below.                                                                                                           |
| `l2nx.cdc-engine.persist.checkpoint-min-interval-seconds` | s    | `300`                            | no       | Minimum interval between snapshot file rewrites of one entity. `≥ 0`.                                                                                                                                                |

The snapshot cache is always on. It is stored as `<persist.dir>/<schema>/<entity>.snap` and reloaded on start, so
the first cycle after a restart also reports rows deleted from the database while the server was down. A lock file
in the directory stops a second adapter with the same schema from using it: give every server that shares a working
directory its own `l2nx.cdc-engine.persist.dir`. Snapshot writes run on the engine pool; on slow storage raise
`l2nx.cdc-engine.workers`.

## nx-gs-runtime-sync-core

The in-memory state sync engine (`l2nx.runtime-sync.*`). Its keys are independent of `l2nx.cdc-engine.*`.

| Key                                       | Type | Default                          | Required | Meaning                                                                              |
| ----------------------------------------- | ---- | -------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `l2nx.runtime-sync.tick-interval-seconds` | s    | `10`                             | no       | Period between reads of in-memory state, each compared with the previous one. `≥ 1`. |
| `l2nx.runtime-sync.publish-flush-seconds` | s    | `5`                              | no       | Same as `l2nx.cdc-engine.publish-flush-seconds`, per tick. `≥ 1`.                    |
| `l2nx.runtime-sync.workers`               | int  | `max(2, min(entities, cores/2))` | no       | Size of the shared engine pool. `≥ 1` when set.                                      |

## nx-gs-gd-sync-core

| Key                                  | Type  | Default | Required | Meaning                                                                                            |
| ------------------------------------ | ----- | ------- | -------- | -------------------------------------------------------------------------------------------------- |
| `l2nx.gd-sync.resync-interval-hours` | hours | `0`     | no       | Period of a scheduled full republish of the game data catalogs. `0` turns the schedule off. `≥ 0`. |

Game data is also republished when the host asks for it after a datapack reload and when the platform requests it,
so the schedule is only a safety net.

## App settings file

`l2nx-app.properties` holds the per-server behaviour of what a character does in the game on a command from the app
while its player is away from the client. `l2nx.properties` connects the server to the platform; this file is the
server's product behaviour and is meant to be edited by its game designer. `nx-gs-adapter-core` reads it on a game
server only (a login server ignores it).

- **Location.** Next to `l2nx.properties`: in the JVM working directory or, when `-Dl2nx.config-file` points
  elsewhere, in the directory of that file. A missing file means every default. JVM system properties do not
  override these keys.
- **Reference file.** [`l2nx-app.properties`](https://github.com/l2nx/nx-gs-adapter/blob/master/l2nx-app.properties)
  lists every key set to its default, with comments. Copy it and change what you need.
- **Defaults.** A missing key takes its default. Every session type and the chat with the app are off by default; revive is on.
- **Values.** Trimmed; `true` / `false` and enumeration names are exact (case matters). The file is UTF-8; a leading
  byte order mark is ignored.
- **Validation.** The whole file is validated first. One invalid value or unknown key (a typo included) applies
  nothing: the previous values stay and the log has one
  `app settings not applied, previous values stay: <key>: <reason>` line per problem. Unlike the `l2nx.*` keys, an
  invalid value never stops the server.
- **Reload.** The adapter checks the file about every 5 seconds and applies a change without a restart; the log shows
  `app settings updated: <key>: <old> -> <new>`.
- **Running sessions.** New values govern new starts. A session keeps the return threshold it started with; a
  disabled session type lets running sessions finish and refuses new starts.

The host reads the live values through the typed `NxAppRules` (`NxAdapter.appRules()`, `ConnectContext.appRules()`,
`CommandContext.appRules()`); `current()` returns an immutable `AppRules` snapshot.

| Key                                        | Type                  | Default                       | Meaning                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------ | --------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.phantom.title.text`                   | string                | `l2nx.app`                    | Display-only title over a character the app placed in the world, instead of its own title. Not stored. 1-16 characters; empty means no override.                                                                                                                                                                                   |
| `app.phantom.title.color`                  | 6 hex digits RGB      | `FFFF00`                      | Colour of that title. Used only when the title text is set.                                                                                                                                                                                                                                                                        |
| `app.session.recent-logout-minutes`        | minutes               | `2`                           | No app start within this time after the character left the game with a client. `0` turns the rule off. `0`-`60`.                                                                                                                                                                                                                   |
| `app.session.restart-window-minutes`       | minutes               | `15`                          | No app start when a scheduled restart is closer than this. `0`-`120`.                                                                                                                                                                                                                                                              |
| `app.session.return-threshold-minutes`     | minutes               | `30`                          | A session that ends with less time in the world than this returns the character to where it started; at or above it the character stays. One threshold for every session type. `≥ 0`.                                                                                                                                              |
| `app.private-store.enabled`                | boolean               | `false`                       | The app private store on this server. `false`: a start is refused as disabled.                                                                                                                                                                                                                                                     |
| `app.private-store.start-cooldown-minutes` | minutes               | `5`                           | No new private-store start (sell or buy) of a character within this time after the real start of that character's previous app private store; keeps prices from being dumped by restarting the store. Other characters of the same player are not held back; closing a store is never limited. `0` turns the rule off. `0`-`1440`. |
| `app.fishing.enabled`                      | boolean               | `false`                       | Offline fishing on this server. `false`: a start is refused as disabled. `true` requires `app.fishing.spot-pool`.                                                                                                                                                                                                                  |
| `app.fishing.start-cooldown-minutes`       | minutes               | `15`                          | No new fishing start for any character of a master account within this time after the real start of that master account's previous app fishing session. `0`-`1440`.                                                                                                                                                                |
| `app.fishing.min-duration-minutes`         | minutes               | `30`                          | Shortest fishing a start may ask for. `≥ 1`.                                                                                                                                                                                                                                                                                       |
| `app.fishing.max-duration-minutes`         | minutes               | `1440`                        | Longest fishing a start may ask for; not below `app.fishing.min-duration-minutes`. The server's own daily limit may still end a session earlier.                                                                                                                                                                                   |
| `app.fishing.float-distance`               | game units            | `170`                         | Distance from the fisher to the float along the spot's heading. `90`-`250`.                                                                                                                                                                                                                                                        |
| `app.fishing.spot-order`                   | `RANDOM`/`FIRST_FREE` | `RANDOM`                      | How a free spot of the pool is picked: any free spot, or the free spot with the lowest id.                                                                                                                                                                                                                                         |
| `app.fishing.spot-pool`                    | string                | empty                         | Name of the spot pool fishing uses on this server; the pool itself (spot ids, coordinates, heading) is the game server's data. 1-32 characters of `a-z`, `0-9` and `_`; empty means no pool. A changed pool governs new starts only.                                                                                               |
| `app.revive.enabled`                       | boolean               | `true`                        | Getting a dead character up at a restart point from the app, with the client still connected or already closed. `false`: a revive is refused as disabled. With `NATIVE` it needs no other key.                                                                                                                                     |
| `app.revive.town.mode`                     | `NATIVE`/`SPOT_POOL`  | `NATIVE`                      | Where a revive "to town" puts the character: as the game itself does for "to village", or a spot of the pools in `app.revive.town.spot-pool` that no running app session holds (any of them when none is free). A character with karma always takes the `NATIVE` location.                                                         |
| `app.revive.town.spot-pool`                | list of pool names    | empty                         | Spot pools a `SPOT_POOL` revive picks from, comma-separated; each 1-32 characters of `a-z`, `0-9` and `_`, no repeats; may name the pool of `app.fishing.spot-pool`. The pools themselves are the game server's data. `SPOT_POOL` with an empty list is invalid.                                                                   |
| `app.chat.enabled`                         | boolean               | `false`                       | Game chat in the app and sending to it from the app. `false`: game chat is not published to the platform, every send from a character in the app is refused as disabled (announcements and lines under a staff name still go out), and an in-game whisper to `Name*` (a character out of game) is answered as to an unknown name.  |
| `app.chat.online-send-channels`            | list of channels      | `CLAN,ALLIANCE,PARTY,WHISPER` | Channels the app may send to while the character is in game: `CLAN`, `ALLIANCE`, `PARTY`, `WHISPER`, comma-separated, no repeats. Empty: the app only reads chat in this state. A send to a channel outside the list is refused.                                                                                                   |
| `app.chat.offline-send-channels`           | list of channels      | `CLAN,ALLIANCE,WHISPER`       | Channels the app may send to while the character is out of game, as above; `PARTY` is invalid here (there is no party out of game). Empty: the app only reads chat in this state.                                                                                                                                                  |
| `app.restore.batch-size`                   | int                   | `10`                          | Sessions restored per batch after a restart. Capped at half of `l2nx.io.workers`. `≥ 1`.                                                                                                                                                                                                                                           |
| `app.restore.batch-pause-millis`           | ms                    | `1000`                        | Pause between restore batches. `≥ 0`.                                                                                                                                                                                                                                                                                              |
| `app.history.retention-days`               | days                  | `90`                          | Closed sessions older than this are deleted from the adapter's table at server start. `≥ 7`.                                                                                                                                                                                                                                       |

## Other modules

`nx-gs-adapter-api`, `nx-gs-kafka`, `nx-gs-commons`, `nx-gs-db-migrations` and `nx-gs-db-migrator-liquibase5` have
no keys of their own. The migrator uses the same `JdbcConnectionSource` as the rest of the adapter.

:::note
The adapter has no database connection keys: `l2nx.db.url`, `l2nx.db.username` and `l2nx.db.password` are not read.
The database is always reached through the `JdbcConnectionSource` the host registers.
:::
