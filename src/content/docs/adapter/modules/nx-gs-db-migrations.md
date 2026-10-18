---
title: nx-gs-db-migrations
description: Liquibase changelog of the adapter-owned l2nx_* tables in the game database.
sidebar:
  order: 6
---

The changelog that creates and evolves the tables the adapter keeps in the game database. All of them have the
`l2nx_` prefix. The artifact contains only resources; the migrator applies it.

## Coordinates

```text
app.l2nx:nx-gs-db-migrations
```

Java 8. Release tag `db-migrations/vX.Y.Z`. Versions on
[Maven Central](https://central.sonatype.com/artifact/app.l2nx/nx-gs-db-migrations).

## When the host needs it

It comes transitively with [`nx-gs-db-migrator-liquibase5`](/adapter/modules/nx-gs-db-migrator-liquibase5/); there
is no need to declare it.

## What to know

- The changelog runs unchanged on PostgreSQL, MariaDB and MySQL.
- It only moves forward: there are no rollback scripts.
- The adapter owns the `l2nx_*` tables. The host's own migrations must not touch them, and the adapter never reads
  the host's changelogs or touches other tables.

## Configuration

No keys of its own.
