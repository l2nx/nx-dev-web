---
title: nx-gs-db-migrations
description: Liquibase changelog таблиц l2nx_*, которыми адаптер владеет в игровой базе.
sidebar:
  order: 6
---

Changelog, который создаёт и развивает таблицы, которые адаптер держит в игровой базе. У всех них префикс `l2nx_`.
Артефакт содержит только ресурсы; применяет его мигратор.

## Координаты

```text
app.l2nx:nx-gs-db-migrations
```

Java 8. Тег релиза `db-migrations/vX.Y.Z`. Версии — на
[Maven Central](https://central.sonatype.com/artifact/app.l2nx/nx-gs-db-migrations).

## Когда нужен хосту

Приходит транзитивно с [`nx-gs-db-migrator-liquibase5`](/ru/adapter/modules/nx-gs-db-migrator-liquibase5/);
объявлять его не нужно.

## Что важно знать

- Changelog без изменений работает на PostgreSQL, MariaDB и MySQL.
- Он движется только вперёд: скриптов отката нет.
- Таблицами `l2nx_*` владеет адаптер. Собственные миграции хоста не должны их трогать, а адаптер никогда не читает
  changelog хоста и не трогает другие таблицы.

## Конфигурация

Своих ключей нет.
