---
title: nx-gs-kafka
description: Lightweight Kafka client for Java 8+ game server cores, used by the other adapter modules.
sidebar:
  order: 8
---

A small Kafka client facade for Java 8 and newer: a producer and consumers with JSON serialization, connection state
tracking and reconnects. The adapter modules publish through it; the connection settings come from the platform at
connect time.

## Coordinates

```text
app.l2nx:nx-gs-kafka
```

Java 8. Release tag `kafka/vX.Y.Z`. Versions on
[Maven Central](https://central.sonatype.com/artifact/app.l2nx/nx-gs-kafka).

## When the host needs it

It comes transitively with [`nx-gs-adapter-core`](/adapter/modules/nx-gs-adapter-core/); there is no need to declare
it. It depends on `org.apache.kafka:kafka-clients` without the native compression libraries: to use `lz4`, `snappy`
or `zstd` compression, add the matching library JAR yourself.

## Configuration

Producer settings are tuned through the core's `l2nx.kafka.producer.*` keys:
[configuration → nx-gs-adapter-core](/adapter/configuration/#nx-gs-adapter-core).
