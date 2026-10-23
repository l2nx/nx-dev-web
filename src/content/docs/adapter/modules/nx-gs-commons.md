---
title: nx-gs-commons
description: Shared utilities of the adapter modules — concurrency helpers, hashing, null handling, client identifiers.
sidebar:
  order: 9
---

Utilities shared by the adapter modules: concurrency helpers, hashing, null handling and service discovery helpers.

## Coordinates

```text
app.l2nx:nx-gs-commons
```

Java 8. Release tag `commons/vX.Y.Z`. Versions on
[Maven Central](https://central.sonatype.com/artifact/app.l2nx/nx-gs-commons).

## When the host needs it

It comes transitively with [`nx-gs-adapter-core`](/adapter/modules/nx-gs-adapter-core/) and the sync modules; there
is no need to declare it.

## Client identifiers

`ClientIdentifiers` (`hwid`, `ip`) normalizes a client's hardware id and IP at the wire boundary. Clients and hosts
fill a missing value with placeholders (`N/A`, `0`, `-`, a zero-filled UUID or address, `::`, blank); such a value
becomes `null`, so unrelated players are not tied together in a per-device limit, a ban or a unique count. A real
value is returned trimmed and otherwise verbatim.

## Configuration

No keys of its own.
