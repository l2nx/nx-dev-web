---
title: nx-gs-db-migrator-liquibase5
description: SchemaMigrator на Liquibase 5, который создаёт и обновляет таблицы l2nx_* адаптера; нужна Java 17.
sidebar:
  order: 7
---

Применяет changelog [`nx-gs-db-migrations`](/ru/adapter/modules/nx-gs-db-migrations/) через Liquibase 5. Core
вызывает его один раз при старте, до запуска любого модуля, поэтому ни один модуль не видит отсутствующую или
устаревшую таблицу.

## Координаты

```text
app.l2nx:nx-gs-db-migrator-liquibase5
```

**Java 17.** Тег релиза `db-migrator-liquibase5/vX.Y.Z`. Версии — на
[Maven Central](https://central.sonatype.com/artifact/app.l2nx/nx-gs-db-migrator-liquibase5).

## Когда нужен хосту

На каждом игровом сервере: без `SchemaMigrator` в classpath адаптер переходит в `FAILED` при старте. Логин-серверу
он не нужен.

## Что предоставляет хост

- `org.liquibase:liquibase-core` 5.x в classpath. Адаптер не поставляет Liquibase в своём составе.
- `JdbcConnectionSource`, которым пользуется остальной адаптер. Его пользователю базы нужны права на запись и DDL
  для таблиц `l2nx_*` и `CREATE` в схеме.

## Что важно знать

- Мигратор хранит историю в собственных таблицах `l2nx_databasechangelog` и `l2nx_databasechangeloglock` и никогда
  не читает и не пишет историю и настройки Liquibase самого хоста.
- Повторный запуск на актуальной базе ничего не меняет.
- Если предыдущий запуск упал посреди миграции и оставил блокировку, старт падает и сообщает, кто её держит. Снять
  блокировку — задача оператора: адаптер не снимает блокировку, которую не брал.

## Конфигурация

Своих ключей нет.
