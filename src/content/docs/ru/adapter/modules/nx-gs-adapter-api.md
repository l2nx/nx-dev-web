---
title: nx-gs-adapter-api
description: Контракты и SPI, общие для хоста, модулей адаптера и платформы.
sidebar:
  order: 2
---

Контракты адаптера: данные, которые он отправляет на платформу, и интерфейсы сервис-провайдеров (SPI), которые
реализуют хост и модули. Хост компилирует свою интеграцию против этого артефакта.

## Координаты

```text
app.l2nx:nx-gs-adapter-api
```

Java 8. Тег релиза `api/vX.Y.Z`. Версии — на
[Maven Central](https://central.sonatype.com/artifact/app.l2nx/nx-gs-adapter-api).

## Когда нужен хосту

Всегда: приходит транзитивно с [`nx-gs-adapter-core`](/ru/adapter/modules/nx-gs-adapter-core/). Держите его на той
версии, которую объявляет core.

## Что реализует хост

Каждый провайдер регистрируется в `META-INF/services/<имя интерфейса>` и находится через `ServiceLoader`.
Интерфейсы лежат в `app.l2nx.gs.adapter.api.spi.provider`.

| Провайдер                        | Кто читает                                                                                               | Обязателен                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `JdbcConnectionSource`           | core, [db-sync](/ru/adapter/modules/nx-gs-db-sync-core/)                                                 | ровно один на игровом сервере       |
| `SchemaMigrator`                 | core; поставляется в [`nx-gs-db-migrator-liquibase5`](/ru/adapter/modules/nx-gs-db-migrator-liquibase5/) | ровно один на игровом сервере       |
| `DbSchemaProvider`               | [db-sync](/ru/adapter/modules/nx-gs-db-sync-core/)                                                       | с db-sync                           |
| `RuntimeStateProvider`           | [runtime-sync](/ru/adapter/modules/nx-gs-runtime-sync-core/)                                             | с runtime-sync                      |
| Провайдеры игровых данных (ниже) | [gd-sync](/ru/adapter/modules/nx-gs-gd-sync-core/)                                                       | по одному на каждый каталог сервера |
| `GameDataReadinessProvider`      | [gd-sync](/ru/adapter/modules/nx-gs-gd-sync-core/)                                                       | нет                                 |
| `OfflineSessionHost`             | core (app sessions)                                                                                      | нет                                 |

Провайдеры игровых данных: `ItemTemplateProvider`, `NpcTemplateProvider`, `SkillProvider`, `RecipeTemplateProvider`,
`ArmorSetTemplateProvider`, `SoulCrystalTemplateProvider`, `ExperienceLevelProvider`, `ClassTemplateProvider`,
`InstanceTemplateProvider`, `GearScoreRulesetProvider`.

Модули реализуют `app.l2nx.gs.adapter.api.spi.AdapterModule` (публичный класс с публичным конструктором без
аргументов). При подключении модуль получает `ConnectContext` с возможностями адаптера: события, команды, триггеры
синхронизации, игровые данные и IO-пул. Хост, который публикует события или обрабатывает команды платформы, делает
это из своего `AdapterModule`. Модуль, бросивший исключение, переходит в `FAILED`; остальные модули продолжают
работать.

## Конфигурация

Своих ключей нет.
