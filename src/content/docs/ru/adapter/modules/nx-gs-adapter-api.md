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
| `GameSettingsProvider`           | core (синхронизация настроек)                                                                            | нет                                 |

Провайдеры игровых данных: `ItemTemplateProvider`, `NpcTemplateProvider`, `SkillProvider`, `RecipeTemplateProvider`,
`ArmorSetTemplateProvider`, `SoulCrystalTemplateProvider`, `ExperienceLevelProvider`, `ClassTemplateProvider`,
`InstanceTemplateProvider`, `GearScoreRulesetProvider`, `ItemOptionProvider`, `AugmentationTargetGroupProvider`,
`LifeStoneProvider`, `FishingBaitProvider`, `FishingRodProvider`, `FishingShotProvider`.

Пока данные не загружены, провайдер возвращает `null` из `snapshot()`. Пустая коллекция (пустой `Optional` у
`GearScoreRulesetProvider`) значит, что каталог пуст, и платформа удаляет все строки этой сущности для сервера.

Три провайдера рыбалки описывают снаряжение, которое принимает сервер: каждый предмет, который он берёт как
наживку, удочку или рыболовный заряд, с шансом, временем рыбалки и грейдом, которые его рыбалка использует для этого
предмета. Сервер без рыбалки не регистрирует ни одного.

Три провайдера аугментации описывают каталог, из которого сервер роллит: все опции предметов, загруженные движком
(у опций аугментации и заточки одно пространство id), группы шаблонов предметов с одинаковым роллом и каждый life
stone с группами, которые он принимает, и вероятностью каждой опции по слотам. Эти вероятности сервер считает своим же
кодом ролла; платформа хранит их как есть.

`GameSettingsProvider` отдаёт конфигурацию движка в том виде, в каком движок её применяет (пределы заточки, лимиты
атрибутов, сборы почты, сбор офлайн-режима частного магазина), чтобы платформа показывала игроку правила сервера.
Адаптер вызывает его из своих IO-потоков при подключении и раз в 5 минут; провайдер собирает снимок из текущей
конфигурации при каждом вызове, поэтому перечитанная конфигурация попадает на платформу в пределах одного периода.
`null` значит, что хост ещё не готов; исключение пишется в лог один раз на серию сбоев, и вызов повторяется в
следующем периоде.

Модули реализуют `app.l2nx.gs.adapter.api.spi.AdapterModule` (публичный класс с публичным конструктором без
аргументов). При подключении модуль получает `ConnectContext` с возможностями адаптера: события, команды, триггеры
синхронизации, игровые данные и IO-пул. Хост, который публикует события или обрабатывает команды платформы, делает
это из своего `AdapterModule`. Модуль, бросивший исключение, переходит в `FAILED`; остальные модули продолжают
работать.

## Сессии приложения и настройки приложения

`OfflineSessionHost` несёт только игровую сторону сессии приложения (поставить, восстановить и убрать персонажа).
Правила приходят из [файла настроек приложения](/ru/adapter/configuration/#файл-настроек-приложения) через
`NxAppRules`: его `current()` возвращает неизменяемый снимок `AppRules`; `ConnectContext.appRules()` и
`CommandContext.appRules()` дают тот же экземпляр. `NxAppSessions` даёт хосту три чтения для правил старта: открытые
сессии мастер-аккаунта (`findOpenByMasterAccount`, в памяти) для проверки «одна сессия на аккаунт», последнюю начатую
сессию мастер-аккаунта (`findLastStartedByMasterAccount`, чтение из базы) для кулдауна старта рыбалки и последнюю
начатую сессию персонажа (`findLastStartedByCharacter`, чтение из базы) только для кулдауна старта частного магазина.
Неудачное чтение из базы завершает свой future исключением; хост отклоняет старт как временно недоступный.
`findOpen` (в памяти) перечисляет все открытые сессии типа, включая ждущие восстановления: хост вызывает его прямо
перед `hostReady()`, чтобы зарезервировать их лимиты и споты. Каждая `OfflineSession` несёт `returnThresholdMs`, с
которым начата. Типы сессий лежат в `app.l2nx.gs.adapter.api.spi.model.session`.

`NxAppSessions.check(characterId, spotPool, spotId)` — режим проверки старта: он выполняет собственные проверки
старта адаптера (одна открытая сессия на персонажа, свободный спот) и отвечает `AppSessionCheckOutcome` (`ALLOWED`,
`CHARACTER_BUSY` с открытой сессией, `SPOT_TAKEN`, `UNAVAILABLE`), ничего не записывая, не занимая спот и не вызывая
`OfflineSessionHost`. На нём стоят команды проверки (`CheckOfflineFishingCommand`): хост проходит свои шаги старта до
первого побочного эффекта и вызывает `check` там, где старт вызывает `start`, поэтому проверка и старт никогда не
отвечают по-разному.

Каждая команда несёт `initiator` (`CommandInitiator`): кто её вызвал — пользователь платформы, необязательные метка,
email и IP запроса. Core проверяет его до вызова обработчика; правила хоста читают мастер-аккаунт из
`initiator.getUserId()`, а IP запроса из `initiator.getIp()`.

## Возрождение мёртвого персонажа

`ReviveCharacterCommand` просит хост поднять мёртвого персонажа в точке возрождения (сейчас `TOWN`, игровое «В
деревню»), при ещё подключённом или уже закрытом клиенте; с `disconnectClient` подключённый клиент закрывается, а
персонаж остаётся вне игры в точке возрождения. Хост регистрирует обработчик, как для любой другой команды, и отвечает
`ReviveCharacterResult` (точка возрождения, где стоит персонаж, закрыт ли клиент) или отказом, причина которого —
`ReviveRefusalReason`. Повтор с тем же `idempotencyKey` отвечает записанным результатом. Настройки приходят из
`AppRules`: `reviveEnabled()`, `reviveTownMode()` (`ReviveTownMode.NATIVE` или `SPOT_POOL`) и `reviveTownSpotPools()`;
ключи `app.revive.*` см. в [конфигурации](/ru/adapter/configuration/#файл-настроек-приложения).

## Чат с приложением

Каналы, ключи метаданных и аудитории — enum, имена которых и есть строки на проводе: `ChatChannel` (канал, который
есть в сборке, но не назван в enum, передаётся как `ChatChannel.unknownToken(rawType)`, `UNKNOWN_<int>`),
`ChatMetadataKey` (ключ в map — `key()`) и `ChatAudience`. Отказ `SendChatMessageCommand` пишет имя
`SendChatMessageRefusalReason` под ключом `SendChatMessageRefusal.REASON`.

`AppRules.chatEnabled()` включает чат с приложением целиком: выключенным хост не публикует игровой чат и отклоняет
любую `SendChatMessageCommand` от персонажа с `CHAT_DISABLED`; команда без `senderCharacterId` (объявление, строка от
имени стаффа) уходит как раньше. `chatOnlineSendChannels()` и `chatOfflineSendChannels()` (множества `ChatChannel`,
каждый с `sendableFromApp()`, в офлайн-списке ещё и с `sendableOffline()`) перечисляют, куда приложение может писать,
пока персонаж в игре и вне её; хост выбирает список по состоянию персонажа в момент выполнения команды и отклоняет
канал вне списка с `CHANNEL_DISABLED`. `SendChatMessageCommand.offlineDelivery = false` просит хост отклонить `WHISPER`
адресату, который не в игре, с `TARGET_OFFLINE` вместо доставки только в приложение; `null` читается как `true`. На
каждом `WHISPER` хост заполняет `SendChatMessageResult.targetInGame`: `true`, когда пакет ушёл в игровой клиент
адресата, `false`, когда сообщение ушло только в приложение. Такой шёпот ещё и несёт
`ChatMetadataKey.UNDELIVERED = "true"` в своём `ChatMessageEvent`. Ключи `app.chat.*` см. в
[конфигурации](/ru/adapter/configuration/#файл-настроек-приложения).

## Конфигурация

Своих ключей нет.
