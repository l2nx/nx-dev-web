---
title: Overview
description: What the L2NX game server adapter is, what it gives a game server, its modules and requirements.
---

`nx-gs-adapter` is a Java library that a game server embeds to connect to the L2NX platform. It runs inside the
JVM of an L2J, Lucera or Essence family core: the core calls the adapter once during boot, and from then on the
adapter keeps the server registered on the platform and streams its data there.

## What it gives the host

- **Connection to the platform.** The adapter exchanges the server key for platform credentials, reports
  liveness every 60 seconds and reconnects with backoff on its own. The host never deals with the platform API
  directly.
- **Database sync.** Characters, clans, items and the other entities the host describes are read from the game
  database and kept in sync on the platform, including rows deleted while the server was down.
- **Runtime sync.** State that lives only in server memory (HP/MP/CP, coordinates, vitality) reaches the platform
  within seconds.
- **Game data sync.** The parsed datapack (item, NPC, skill, recipe and other templates) is published as a
  catalog for the wiki, market and gear score.
- **Events and commands.** The host publishes game events through the adapter, and the platform sends commands
  back (mail delivery, bans, chat messages, character administration); the adapter delivers each command to a
  handler the host registers and returns the result.

Each capability is a separate module: the host puts on the classpath only what it uses.

## Who does what

- **Host developer** (the author of the game server build) adds the modules as dependencies, calls
  `NxAdapter.start()` during boot and implements the providers the modules read from: the database connection, the
  schema description, in-memory state, game data catalogs.
- **Operator** (whoever runs the server) puts `l2nx.properties` with the server key next to the server and starts
  it. No code is involved.

Both paths are covered in the [quick start](/adapter/quick-start/).

## Open core

The public modules are open source under the Apache License 2.0 and published to Maven Central as
`app.l2nx:*`. An operator can audit every artifact that loads into the game server JVM, and a build pulls them
without any private repository.

Modules that encode one client's proprietary database schema or datapack layout are shipped privately to that client
and are never published, so one client's schema does not leak to others.

## Requirements

- **Java 8 or newer.** Every module except one targets Java 8 and runs on current JDKs.
- **Java 17 for `nx-gs-db-migrator-liquibase5`.** It is built on Liquibase 5, which needs Java 17. A game server
  host needs this migrator (see below), so a game server currently runs on Java 17 or newer.
- **A database connection.** A game server host registers exactly one `JdbcConnectionSource` that hands out
  connections from its existing pool. The adapter keeps its own state in `l2nx_*` tables in the game database and
  creates them itself through `nx-gs-db-migrator-liquibase5` with `org.liquibase:liquibase-core` 5.x that the host
  provides. The database user needs `SELECT` on the game tables, plus write and DDL rights on the `l2nx_*` tables
  and `CREATE` in the schema. Database credentials stay on the host and never travel to the platform.
- **Outbound network.** HTTPS to the platform URL from the configuration, and a connection to the Kafka broker
  whose address the platform returns at connect time.
- **Logging.** If the host has an SLF4J binding, the adapter logs through it; otherwise it writes to the console.

## Modules

| Module                                                                           | Purpose                                                         |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`nx-gs-adapter-core`](/adapter/modules/nx-gs-adapter-core/)                     | Runtime: connect, heartbeat, module discovery, events, commands |
| [`nx-gs-adapter-api`](/adapter/modules/nx-gs-adapter-api/)                       | Contracts and SPI the host and modules implement                |
| [`nx-gs-db-sync-core`](/adapter/modules/nx-gs-db-sync-core/)                     | Database sync of the entities the host describes                |
| [`nx-gs-runtime-sync-core`](/adapter/modules/nx-gs-runtime-sync-core/)           | Sync of in-memory server state                                  |
| [`nx-gs-gd-sync-core`](/adapter/modules/nx-gs-gd-sync-core/)                     | Game data (datapack) catalog sync                               |
| [`nx-gs-db-migrations`](/adapter/modules/nx-gs-db-migrations/)                   | Changelog of the adapter-owned `l2nx_*` tables                  |
| [`nx-gs-db-migrator-liquibase5`](/adapter/modules/nx-gs-db-migrator-liquibase5/) | Applies that changelog with Liquibase 5 (Java 17+)              |
| [`nx-gs-kafka`](/adapter/modules/nx-gs-kafka/)                                   | Lightweight Kafka client used by the other modules     |
| [`nx-gs-commons`](/adapter/modules/nx-gs-commons/)                               | Shared utilities used by the other modules                      |

## Versioning

Every module has its own version and is released independently: a release tag looks like `core/v0.44.0` or
`db-sync/v0.12.0`, and only that module is published by it. Releases of all modules are listed in the
[changelog](/adapter/changelog/); breaking changes come with steps in the [migration guide](/adapter/migration/).
