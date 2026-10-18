---
title: nx-gs-adapter-core
description: The adapter runtime — platform connect, heartbeat, module discovery, events and commands.
sidebar:
  order: 1
---

The adapter runtime and the entry point for the host. It connects the server to the platform, keeps it registered,
discovers the other modules on the classpath and runs them.

## Coordinates

```text
app.l2nx:nx-gs-adapter-core
```

Java 8. Release tag `core/vX.Y.Z`. Versions on
[Maven Central](https://central.sonatype.com/artifact/app.l2nx/nx-gs-adapter-core).

## When the host needs it

Always. It brings `nx-gs-adapter-api`, `nx-gs-kafka` and `nx-gs-commons` transitively.

## What it does

- Exchanges the server key for platform credentials, retries with backoff, and sends a heartbeat every 60 seconds
  with the status of every module.
- On a game server, before any module starts, applies the changelog of the adapter-owned `l2nx_*` tables through the
  `SchemaMigrator` on the classpath (see
  [`nx-gs-db-migrator-liquibase5`](/adapter/modules/nx-gs-db-migrator-liquibase5/)).
- Discovers modules (`AdapterModule`) through `ServiceLoader` after the connect and starts them.
- Publishes the events the host sends through the adapter, from one bounded queue.
- Delivers platform commands to the handlers the host registers and sends back their results.
- Runs a shared IO pool for blocking work of modules and handlers, so that work never runs on the game thread.
- Runs app sessions when the host provides an `OfflineSessionHost`.

## Host API

The host talks to the adapter through `app.l2nx.gs.adapter.core.NxAdapter`:

| Method                    | Purpose                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `start()`                 | Starts the adapter. Returns at once and never throws; repeated calls are ignored.                       |
| `state()`                 | Current state: `INIT`, `REGISTERING`, `ACTIVE`, `DEGRADED`, `FAILED`, `REJECTED`, `DISABLED`, `CLOSED`. |
| `onStateChange(callback)` | Callback on every state change.                                                                         |
| `hostExecutor(executor)`  | Executor that runs work on the game side for command handlers. Set it before `start()`.                 |
| `migrateSchema()`         | Migrates the `l2nx_*` tables early, for a host that reads them before `start()`. Runs once.             |
| `shutdown()`              | Stops the adapter and delivers queued events. The adapter's JVM shutdown hook calls it too.             |

See the [quick start](/adapter/quick-start/) for the boot sequence.

## Configuration

Connection, IO pool, Kafka producer, events and commands keys:
[configuration → nx-gs-adapter-core](/adapter/configuration/#nx-gs-adapter-core).
