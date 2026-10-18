---
title: nx-gs-db-migrator-liquibase5
description: SchemaMigrator on Liquibase 5 that creates and updates the adapter's l2nx_* tables; needs Java 17.
sidebar:
  order: 7
---

Applies the [`nx-gs-db-migrations`](/adapter/modules/nx-gs-db-migrations/) changelog through Liquibase 5. The core
calls it once at start, before any module runs, so no module sees a missing or outdated table.

## Coordinates

```text
app.l2nx:nx-gs-db-migrator-liquibase5
```

**Java 17.** Release tag `db-migrator-liquibase5/vX.Y.Z`. Versions on
[Maven Central](https://central.sonatype.com/artifact/app.l2nx/nx-gs-db-migrator-liquibase5).

## When the host needs it

On every game server: without a `SchemaMigrator` on the classpath the adapter goes `FAILED` at start. A login server
does not need it.

## What the host provides

- `org.liquibase:liquibase-core` 5.x on the classpath. The adapter does not bundle Liquibase.
- The `JdbcConnectionSource` the rest of the adapter uses. Its database user needs write and DDL rights on the
  `l2nx_*` tables and `CREATE` in the schema.

## What to know

- The migrator keeps its history in its own tables `l2nx_databasechangelog` and `l2nx_databasechangeloglock`, and
  never reads or writes the host's own Liquibase history or settings.
- A second run on an up-to-date database changes nothing.
- If a previous run died mid-migration and left the lock behind, the start fails and reports the lock holder.
  Releasing the lock is up to the operator: the adapter does not release a lock it did not take.

## Configuration

No keys of its own.
