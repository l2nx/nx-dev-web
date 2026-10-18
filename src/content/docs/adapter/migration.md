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
