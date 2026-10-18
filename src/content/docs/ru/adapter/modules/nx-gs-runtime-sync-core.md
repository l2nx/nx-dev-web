---
title: nx-gs-runtime-sync-core
description: Модуль runtime-синхронизации — публикует состояние из памяти сервера, например HP/MP/CP и координаты.
sidebar:
  order: 4
---

Публикует состояние, которое живёт только в памяти сервера и попадает в базу поздно или никогда: текущие HP/MP/CP,
координаты, vitality. На каждом тике модуль читает состояние у хоста, сравнивает его с предыдущим тиком и публикует
только изменения.

## Координаты

```text
app.l2nx:nx-gs-runtime-sync-core
```

Java 8. Тег релиза `runtime-sync/vX.Y.Z`. Версии — на
[Maven Central](https://central.sonatype.com/artifact/app.l2nx/nx-gs-runtime-sync-core).

## Когда нужен хосту

Когда платформа должна показывать живое состояние с задержкой в секунды. Работает рядом с
[`nx-gs-db-sync-core`](/ru/adapter/modules/nx-gs-db-sync-core/) и не заменяет его.

## Что предоставляет хост

Один `RuntimeStateProvider`, который возвращает текущие строки каждой runtime-сущности из памяти. К базе модуль не
обращается.

## Конфигурация

Ключи `l2nx.runtime-sync.*`:
[конфигурация → nx-gs-runtime-sync-core](/ru/adapter/configuration/#nx-gs-runtime-sync-core).
