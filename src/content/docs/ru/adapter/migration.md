---
title: Руководство по миграции
description: Шаги обновления адаптера через breaking changes.
---

На этой странице собраны шаги, которые хосту нужно выполнить, когда релиз адаптера ломает совместимость. Релизы без
записи здесь ставятся без изменений: поднимите версию и перезапустите сервер.

## Как объявляются breaking changes

- У каждого модуля своя версия (`core/v…`, `api/v…`, `db-sync/v…`), и каждый релиз появляется в
  [changelog](/ru/adapter/changelog/) со своими notes.
- Релиз, который требует действий от хоста, получает раздел на этой странице, новые сверху: какой модуль и версия,
  что изменилось и что делать.
- Документация всегда описывает текущую версию.

## nx-gs-adapter-api 0.127.0, nx-gs-adapter-core 0.55.0, nx-gs-gd-sync-core 0.17.0: Kafka-заголовки без `Nx-`

Адаптер шлёт и читает Kafka-заголовки без префикса `Nx-`. Три модуля поднимаются вместе.

- `Nx-Message-Type` теперь `Message-Type`, `Nx-Correlation-Id` — `Correlation-Id`.
- `Nx-Server-Id` и `Nx-Target-Server-Id` слились в один заголовок `Server-Id`: в каждой записи, которую публикует
  адаптер, это сервер-источник, во входящей команде — сервер-адресат. Команда без `Server-Id` или для другого сервера,
  как и раньше, отбрасывается.
- `NxHeaders.NX_SERVER_ID`, `NX_TARGET_SERVER_ID`, `NX_MESSAGE_TYPE` и `NX_CORRELATION_ID` удалены: используйте
  `NxHeaders.SERVER_ID`, `MESSAGE_TYPE` и `CORRELATION_ID`. Код хоста, который сам читает или пишет эти заголовки,
  переходит на новые константы.
- Платформа читает оба имени и шлёт оба, поэтому игровые серверы переходят на новый адаптер по одному.

## nx-gs-adapter-api 0.125.0, nx-gs-adapter-core 0.54.0: `APP_BAIT_LEVEL_MISMATCH`, `APP_NO_ROD`

Только добавления: хосту, который не отправляет ни одну из этих причин, ничего менять не нужно. Берите оба модуля
вместе: новые причины от `NxAppSessions.onActionEnded` принимает core.

- Новая причина завершения `LogoutReason.APP_BAIT_LEVEL_MISMATCH`: выбранная наживка ушла из руки, потому что уровень
  персонажа вышел из её диапазона. Стопка наживки при этом ещё в инвентаре; если стопки нет, причина остаётся
  `APP_OUT_OF_BAIT`.
- Новая причина завершения `LogoutReason.APP_NO_ROD`: удочка ушла из рук, её условия перестали выполняться или её
  больше нет.
- `APP_INTERRUPTED` больше не означает потерю снаряжения. Это игра остановила действие поставленного персонажа: его
  сдвинули со спота, игра закрыла лавку или действие не удалось возобновить. Лавка из приложения, которую закрыла
  игра, завершается с этой причиной. Хост на старом core до перезапуска отправляет `APP_INTERRUPTED` и для потери
  снаряжения.
- Core 0.54.0 принимает от хоста `APP_TIME_UP` для сессии без плана: лавки из приложения, у которой закончилось
  оплаченное оффлайн-время. Сессия с планом завершается собственным таймером движка, и для неё core `APP_TIME_UP`
  отклоняет. Старые core игнорируют `APP_TIME_UP` от хоста.
- Отправляйте новую причину только когда платформа её принимает: новая причина сначала появляется в адаптере, затем на
  платформе, затем в хосте.

## nx-gs-adapter-api 0.124.0, nx-gs-adapter-core 0.53.0, nx-gs-runtime-sync-core 0.6.0, nx-gs-db-migrations 0.6.0: результаты сессий, снимки предметов, старт runtime-синхронизации

**Ломающее изменение.** Берите все четыре модуля вместе. Хост
переходит на него в том релизе, который его берёт.

**Вызовите `NxAdapter.runtimeSync().hostStarted()`, иначе runtime-синхронизация ничего не отправит.** Вызов один, сразу
после публикации `ServerStartedEvent`, ушло событие или ждёт привязки канала событий. Таймера и запасного пути нет:
хост, который не вызвал метод, тиков не получит. `NxAppSessions.hostReady()` вызывается раньше него.

- `CharacterPresenceEvent.charId` теперь `characterId`, и в билдере, и на проводе.
- Все `charId` и `*CharId` в api теперь `characterId` и `*CharacterId` (`buyerCharId` стал `buyerCharacterId`,
  `targetCharId` стал `targetCharacterId`): команды, результаты, события и `RatingDbDto`. Меняются и билдер, и провод.
- `charName` и `targetCharName` теперь `characterName` и `targetCharacterName`, в `ChatMessageEvent` и
  `TelegramCharacterLinkCommand`. Меняются и билдер, и провод.
- `TransferCharToAccountCommand` теперь `TransferCharacterToAccountCommand`, `TelegramCharLinkCommand` теперь
  `TelegramCharacterLinkCommand`, вместе с классами `*Result`. Команды маршрутизируются по простому имени класса, поэтому
  меняется и `Nx-Message-Type`: зарегистрируйте обработчик на новый класс, отправитель старого имени получит
  `UNSUPPORTED_COMMAND`.
- `CharacterPresenceEvent` принимает `result` (`SessionResult`), только при `online = false`. Клиентская сессия задаёт его
  через билдер, app-сессия получает от движка. `activity` при `source = CLIENT` разрешён только как
  `OFFLINE_PRIVATE_STORE`, сессия нативного офлайн-магазина.
- `OfflineSessionHost.takeSessionResult(session)` — новый `default`-метод, отвечающий `null`. Переопределите его, чтобы
  передавать результаты. Движок вызывает его один раз после каждого `removeFromWorld`, включая откат старта и персонажа,
  которого не удалось разместить, так что recorder, хранимый по id сессии, можно отпустить здесь, кроме случая, когда конец гонится со штатной остановкой, уже сохранившей блок: такой конец вызов пропускает. Вызов идёт и при
  штатной остановке для каждой оставшейся открытой сессии.
- `OfflineSession.getCarriedResult()` содержит текущий блок после штатной остановки, в тех представлениях, что
  `placeInWorld` и `startAction` получают при восстановлении. Заполните им recorder. Пустой блок значит, что записывать
  было нечего; `null` — что блок потерян, и завершение придёт с `partial`.
- Результат больше `SessionResult.MAX_JSON_BYTES` отбрасывается, завершение уходит без него: до этого предела сворачивайте
  `uniques` в `items`.
- Новые значения: `LogoutReason.SOLD_OUT` и `APP_OVERWEIGHT` (второе принимает `onActionEnded`), отказы
  `NO_FISHING_EXPERTISE`, `BAIT_LEVEL_MISMATCH`, `INVENTORY_FULL`, `OVERWEIGHT`. `INVENTORY_FULL` и `OVERWEIGHT` несут свои
  числа в `CommandProblem.extensions` и в `AppSessionCheckResult`, где они задаются через билдер. `APP_INVENTORY_FULL`
  больше не покрывает вес.
- Формы предметов несут `ItemSnapshot` в `item` вместо отдельных полей, команды предметов используют `characterId`.
  Проверка покупки сравнивает `BuyLine.attributesForMatch()`: пустая карта считается `null`.
- В `ConnectContext` появился `runtimeSync()`: собирайте его билдером.
- Новый ключ `app.shutdown.result-millis-per-session` в `l2nx-app.properties` и миграция, добавляющая столбец в таблицу
  сессий адаптера; применяется при старте.

## nx-gs-adapter-api 0.123.0, nx-gs-adapter-core 0.52.0: словари чата как enum, настройки чата, доставка шёпота

**Ломает совместимость для Java-кода (на уровне исходников); строки на проводе не меняются.** Классы констант чата
стали enum с теми же именами на проводе, и три конструктора получили новый параметр. Хост переключается в релизе,
который берёт этот api: ни одно сообщение не меняет форму, поэтому платформа, читающая старые строки, читает новый хост
как раньше. С обновлением core чат с приложением по умолчанию выключен: хост, который публикует игровой чат и
обрабатывает `SendChatMessageCommand`, ставит `app.chat.enabled=true` в своём `l2nx-app.properties`, чтобы сохранить
текущее поведение.

Переименованные типы (без deprecated-копий):

| Было                                      | Стало                                     | Примечание                                                                                                                                       |
| ----------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `kafka.events.chat.WellKnownChatChannels` | `kafka.events.chat.model.ChatChannel`     | те же имена констант; `ChatChannel.unknownToken(rawType)` строит `UNKNOWN_<int>`, `ChatChannel.fromToken` читает токен (`null`, если неизвестен) |
| `kafka.events.chat.ChatMetadataKeys`      | `kafka.events.chat.model.ChatMetadataKey` | ключ в map — `key()` (`source`, `shadowed`, `rawType`, `serverWide`, `undelivered`), не `name()`                                                 |
| `kafka.commands.chat.ChatAudiences`       | `kafka.commands.chat.model.ChatAudience`  | те же имена констант                                                                                                                             |

`ChatMessageEvent.channel`, `SendChatMessageCommand.channel` и `.audience` остаются строками; их билдеры принимают и
enum. Код, который клал строковую константу в `metadata`, теперь пишет `ChatMetadataKey.X.key()`.

- **Причины отказа.** Новый `SendChatMessageRefusalReason`, пишется под ключом `SendChatMessageRefusal.REASON`
  (`"reason"`): `CHAT_FORBIDDEN` (`FORBIDDEN`), `NOT_IN_CLAN`, `NOT_IN_ALLIANCE`, `NOT_IN_PARTY` (`INVALID_STATE`),
  `TARGET_NOT_FOUND` (`NOT_FOUND`), `ITEM_NOT_OWNED` (`VALIDATION_FAILED`) и новые `CHAT_DISABLED`,
  `CHANNEL_DISABLED`, `TARGET_OFFLINE` (`INVALID_STATE`). Строки те же, что хосты уже отправляют: замените свои
  константы причин на `name()` этого enum.
- **Настройки чата.** Новые члены `AppRules`: `chatEnabled()`, `chatOnlineSendChannels()` и
  `chatOfflineSendChannels()`, и ключи `app.chat.enabled` (по умолчанию `false`), `app.chat.online-send-channels`
  (по умолчанию `CLAN,ALLIANCE,PARTY,WHISPER`) и `app.chat.offline-send-channels` (по умолчанию
  `CLAN,ALLIANCE,WHISPER`), см. [конфигурацию](/ru/adapter/configuration/#файл-настроек-приложения). С выключенным
  чатом хост не публикует игровой чат и отклоняет любую отправку от персонажа с `CHAT_DISABLED`; команда без
  `senderCharacterId` (объявление, строка от имени стаффа) — не чат с приложением и уходит как раньше. Отправка в канал
  вне списка для текущего состояния персонажа отклоняется с `CHANNEL_DISABLED`; список хост выбирает по тому, в игре ли
  персонаж в момент выполнения команды.
- У `AppSettings` появилось поле `chat` (`ChatSettings`), новый предпоследний параметр конструктора: код, который сам
  собирает `AppSettings`, передаёт `null` или `ChatSettings`.
- У `SendChatMessageCommand` появилось поле `offlineDelivery` (`Boolean`), **последний** параметр конструктора (после
  `initiator`). `false`: `WHISPER` адресату, который не в игре, отклоняется с `TARGET_OFFLINE`, ничего не публикуется;
  `null` (более старая платформа) читается как `true`.
- У `SendChatMessageResult` появилось поле `targetInGame` (`Boolean`), последний параметр конструктора. Заполняйте его
  на каждом `WHISPER`: `true`, когда пакет ушёл в игровой клиент адресата, `false`, когда адресат не в игре и сообщение
  ушло только в приложение; на других каналах оставляйте `null`. Платформа берёт доставку из него, а не из
  `recipients`.
- Новый `ChatMetadataKey.UNDELIVERED`: хост ставит `"true"` в `ChatMessageEvent` шёпота, который не дошёл ни до одного
  игрового клиента адресата (шёпот из игры на `Name*` или отправка из приложения адресату, который не в игре).

## nx-gs-adapter-api 0.122.0: слоты частного магазина покупки в runtime-синхронизации

**Ломает совместимость (на уровне исходников).** Канонический конструктор `CharacterRuntimeDto` получает новый
последний параметр `privateStoreBuySlots` (`Integer`): максимальное число строк, которое частный магазин покупки
персонажа может держать сейчас, независимо от `privateStoreSellSlots`. Провайдер считает его по тем же правилам, что и
лимит продажи, и передаёт `null`, если не сообщает его. Код, который сам собирает `CharacterRuntimeDto` (провайдеры,
тесты), добавляет аргумент.

## nx-gs-adapter-api 0.120.0, nx-gs-adapter-core 0.51.0, nx-gs-gd-sync-core 0.16.0, nx-gs-db-migrations 0.5.0: инициатор команды, проверки сессий, рыболовное снаряжение

**Ломает совместимость.** Обновите api, core и gd-sync вместе и переключите хост одним релизом.

- **Инициатор команды.** Каждая команда несёт обязательный `initiator` (`CommandInitiator`): кто её вызвал (`source`:
  `user` или имя отправившего сервиса платформы; `userId` задан ровно для пользователя; необязательные `label`,
  `email`, `ip`). У `NxCommand` есть `getInitiator()`, его принимают все конструкторы и билдеры команд. Core отклоняет
  команду без корректного инициатора с `VALIDATION_FAILED` до вызова вашего обработчика, а команде `OwnerVerified`
  нужен ещё источник `user`, поэтому обработчик читает корректный инициатор и не перепроверяет его. Его `ip` уже прошёл
  `ClientIdentifiers`. Код, который сам собирает команды (тесты, утилиты), передаёт инициатор.
- **Удалены `masterAccountId` и `initiatorIp`** из `StartOfflineFishingCommand`, `StopOfflineFishingCommand`,
  `ReviveCharacterCommand` и команд старта частного магазина (`StartPrivateStoreCommand`), deprecated-копии нет.
  Мастер-аккаунт читайте из `initiator.getUserId()`, IP запроса из `initiator.getIp()` и передавайте их в
  `AppSessionStartRequest`, как раньше. `BanCommand.issuedBy` и `SendCaptchaCommand.issuedBy` остаются: это имя,
  которое запись показывает в игре, а не атрибуция.
- **Перенос пакета.** `AppSessionStartRequest`, `AppSessionStartOutcome`, `ClientLoginOutcome`, `OfflineSession` и
  `OfflineSessionPlacement` переехали из `app.l2nx.gs.adapter.api.spi.model` в
  `app.l2nx.gs.adapter.api.spi.model.session`. Замените импорты; больше в них ничего не изменилось.
- **Проверки сессий.** `NxAppSessions.check(characterId, spotPool, spotId)` отвечает `AppSessionCheckOutcome`
  (`ALLOWED`, `CHARACTER_BUSY` с открытой сессией, `SPOT_TAKEN`, `UNAVAILABLE`), ничего не записывая, не занимая спот и
  не вызывая `OfflineSessionHost`. Новая `CheckOfflineFishingCommand` (результат `AppSessionCheckResult`) спрашивает,
  стартовала бы рыбалка с этими входными данными сейчас: пройдите свои шаги старта до первого побочного эффекта и
  вызовите `check` там, где старт вызывает `start`. Отказ — успешная проверка (`OK`, `allowed = false`). Пока вы не
  зарегистрировали обработчик, адаптер отвечает на команду как на неподдерживаемую. Код, который сам реализует
  `NxAppSessions`, добавляет `check`.
- **Новые значения отказов.** `AlreadyActiveScope.IP` (ваш лимит по IP, считается по `initiator.ip`; отсутствующий IP
  ничего не ограничивает) и значения `AppSessionRefusalReason`
  `NO_FISHING_SHOT`, `INVALID_FISHING_SHOT` и `FISHING_SHOT_GRADE_MISMATCH` для нового необязательного
  `StartOfflineFishingCommand.fishingShotItemId`. Отказ `DAILY_LIMIT` теперь может нести `retryAt` — момент сброса
  суточного лимита; если ваша сборка этот момент не знает, не передавайте его.
- **`ActivityMetadataKey`** называет ключи `metadata` строки activity usage (`elapsed`, `remaining`, `rodItemId`,
  `baitItemId`, `fishingShotItemId`, `spotPool`, `spotId`); пишите `key()` вместо своих строк. Словарь остаётся
  открытым.
- **Снимок открытых сессий.** Core публикует `AppSessionsSnapshotEvent` (id всех открытых сессий приложения сервера)
  раз в 60 с и при старте модуля app-sessions и переотправляет завершение сессии, пока платформа его не подтвердит. На
  хосте поднимите `nx-gs-db-migrations` до 0.5.0 вместе с core: нужную колонку добавляют его changeset-ы.
- **Каталог рыболовного снаряжения.** Новые провайдеры игровых данных `FishingBaitProvider`, `FishingRodProvider` и
  `FishingShotProvider` (сущности `fishingbait`, `fishingrod`, `fishingshot`). Необязательны: сервер без рыбалки не
  регистрирует ни одного. Хост, который их реализует, регистрирует каждый в `META-INF/services` и возвращает `null`
  из `snapshot()`, пока его данные не загружены.
- **Пустой снимок игровых данных теперь удаляет.** Зарегистрированный провайдер, вернувший пустую коллекцию (или
  пустой `Optional` из `GearScoreRulesetProvider`), заставляет платформу удалить все строки этой сущности для сервера.
  Пока данные не загружены, возвращайте `null`, а не пустую коллекцию.

## nx-gs-adapter-api 0.119.0: `clanId` и `allianceId` в сообщениях чата

**Ломает только Java-код.** `ChatMetadataKeys.CLAN_ID` и `ChatMetadataKeys.ALLIANCE_ID` удалены, deprecated-копии нет.
У `ChatMessageEvent` появились поля `clanId` и `allianceId` (`Long`, nullable) на каждом канале; конструктор принимает
их двумя новыми последними параметрами, а у билдера есть `clanId(...)` и `allianceId(...)`.

- Хост, который писал id клана и альянса в `metadata` события, задаёт вместо этого два поля и перестаёт писать эти
  ключи: платформа больше не читает их из `metadata`.
- Поля хранят клан и альянс говорящего на момент реплики. Сообщение без законного отправителя несёт адресата: на `CLAN`
  его клан и альянс, на `ALLIANCE` только альянс. Нет клана или альянса: `null`.
- Код, который вызывает конструктор `ChatMessageEvent` напрямую, передаёт в новые параметры `null` либо id.

## nx-gs-adapter-api 0.119.0, nx-gs-adapter-core 0.50.0: возрождение мёртвого персонажа

Только добавления: хосту, который не обрабатывает новую команду, менять ничего не нужно. Пока обработчика нет,
платформа не предлагает возрождение для сервера (публикуемые настройки приложения не несут группы `revive`), а более
старый хост отвечает на команду как на любую неизвестную.

- Новые `ReviveCharacterCommand` / `ReviveCharacterResult`: поднимают мёртвого персонажа в точке возрождения (`TOWN`) при
  подключённом или уже закрытом клиенте. Хост, которому нужна функция, регистрирует для неё обработчик и отказывает
  кодом `ReviveRefusalReason`, когда возрождение невозможно.
- Новые члены `AppRules`: `reviveEnabled()`, `reviveTownMode()` и `reviveTownSpotPools()`, и ключи
  `app.revive.enabled` (по умолчанию `true`), `app.revive.town.mode` (по умолчанию `NATIVE`, либо `SPOT_POOL`) и
  `app.revive.town.spot-pool`, см. [конфигурацию](/ru/adapter/configuration/#файл-настроек-приложения). Файл сервера без
  них продолжает работать. У `AppSettings` появилось поле `revive`; публичный конструктор принимает его новым
  параметром, поэтому код, который сам собирает `AppSettings`, передаёт `null` или `ReviveSettings`.

## nx-gs-adapter-api 0.117.1, nx-gs-adapter-core 0.49.1: `LifeStoneGrade.JEWELRY`, `GameSettingsProvider`

**Ломает только Java-код.** Константа `ACCESSORY` в `LifeStoneGrade` теперь `JEWELRY` (слоты шеи, ушей и пальцев);
deprecated-копии нет. Хосту, который собирает данные life stone, достаточно заменить константу; грейд уходит по имени,
поэтому ещё не обновлённый хост продолжает слать `ACCESSORY` до пересборки.

Только добавления: необязательный `GameSettingsProvider` (см. [api](/ru/adapter/modules/nx-gs-adapter-api/))
публикует конфигурацию движка (лимиты заточки, лимиты атрибутов, плата за почту, плата за офлайн-лавку). Хост без него
работает как раньше и не публикует игровые настройки; хост, который его реализует, регистрирует его в
`META-INF/services` и возвращает `null` из `gameSettings(...)`, пока конфигурация не загружена. Две зарегистрированные
реализации роняют модуль.

## nx-gs-adapter-api 0.116.0, nx-gs-gd-sync-core 0.15.0: `StatModifier`, каталог аугментации

**Ломает только Java-код.** `SkillStatModifier` (пакет `app.l2nx.gs.adapter.api.kafka.sync.gd.skill.effect`) теперь
`StatModifier` в `app.l2nx.gs.adapter.api.kafka.sync.gd`: его используют и скиллы, и опции предметов. Поля, геттеры,
билдер и JSON не изменились, deprecated-копии нет. Хосту, который собирает данные скиллов, достаточно заменить импорт и
имя класса.

Только добавления: три новых провайдера игровых данных, `ItemOptionProvider`, `AugmentationTargetGroupProvider` и
`LifeStoneProvider` (сущности `itemoption`, `augmentationtargetgroup`, `lifestone`). Хост без них работает как раньше;
хост, который их реализует, регистрирует каждый в `META-INF/services`, как остальные провайдеры, и возвращает `null` из
`snapshot()`, пока его данные не загружены. Обновляйте `nx-gs-gd-sync-core` вместе с api: публикует их этот модуль.

## nx-gs-adapter-api 0.115.0, nx-gs-adapter-core 0.48.0: открытые сессии типа, `APP_INTERRUPTED`

Только добавления: хосту, который не использует ни одно из них, ничего менять не нужно.

- Новое `NxAppSessions.findOpen(ActivityType activity)`: все сессии этого типа, которые держит адаптер (идущие,
  ждущие восстановления после рестарта, старт в процессе, завершение, которое ещё записывается), по `startedAt`, затем
  по id. Читает только память, поэтому вызывать можно из любого потока; без работающего движка сессий отвечает пустым
  списком. Вызовите его прямо перед `hostReady()`, чтобы учесть сессии, ждущие восстановления, в своих лимитах на
  аккаунт и на устройство и исключить их споты (`OfflineSession.getSpotPool()`, `getSpotId()`) из выбора свободного
  спота.
- Новая причина завершения `LogoutReason.APP_INTERRUPTED`, её принимает `NxAppSessions.onActionEnded`: игра остановила
  действие поставленного персонажа (его телепортировали, пропал инструмент или расходник, без которого действие не
  идёт, действие не удалось перезапустить). Используйте её вместо `KICKED` (кик стаффом) и `APP_STOPPED` (остановка
  игроком). Отправляйте её только когда платформа её принимает: новая причина сначала появляется в
  адаптере, затем на платформе, затем в хосте.

## nx-gs-adapter-api 0.114.0, nx-gs-adapter-core 0.47.0: титул по умолчанию у поставленного персонажа

У `app.phantom.title.text` теперь значение по умолчанию `l2nx.app`, а не «без титула». Если ключа в файле сервера нет,
над персонажами, которых приложение поставило в мир, виден `l2nx.app`. Чтобы оставить персонажу его собственный титул,
задайте пустое значение (`app.phantom.title.text=`). Хостам код менять не нужно.

## nx-gs-adapter-api 0.112.0, nx-gs-adapter-core 0.46.0, nx-gs-db-migrations 0.4.0: кулдаун старта частного магазина

**Что изменилось.** Частный магазин из приложения больше нельзя сразу перезапустить, чтобы сбить цены: новый старт
персонажа ждёт несколько минут после фактического старта предыдущего магазина этого персонажа из приложения. Адаптер
несёт правило и данные, соблюдает его хост.

- Новый ключ `app.private-store.start-cooldown-minutes` в `l2nx-app.properties` (по умолчанию `5`, `0` отключает
  правило, `0`-`1440`; см. [конфигурацию](/ru/adapter/configuration/#файл-настроек-приложения)) и его типизированное
  значение `AppRules.privateStoreStartCooldownMinutes()`.
- Новый `NxAppSessions.findLastStartedByCharacter(int characterId, ActivityType activity)`: сессия персонажа этого
  типа с самым поздним фактическим стартом, открытая или закрытая. Правила те же, что у чтения по мастер-аккаунту:
  старты, которые на деле не состоялись, не считаются.
- Переименование: `NxAppSessions.findLastStarted(UUID, ActivityType)` теперь называется
  `findLastStartedByMasterAccount(UUID, ActivityType)`; устаревшая копия не сохраняется.
- Оба чтения завершают future исключением при ошибке базы, а также пока движок сессий адаптера не работает (ещё
  загружается, выключен или не запущен). До этого релиза чтение по мастер-аккаунту в таком случае отвечало пустым
  `Optional`.
- Новый код отказа `PrivateStoreReason.COOLDOWN` (`INVALID_STATE`, с `retryAt`).
- Снимок настроек `AppSettings`: новое поле `privateStoreStartCooldownMinutes`, а `startCooldownMinutes`
  переименовано в `fishingStartCooldownMinutes` (геттер и метод builder тоже). Конструктор принимает новое поле,
  поэтому код, собирающий `AppSettings` (в том числе тесты), пользуется builder.
- Новый changeset `0010` в `nx-gs-db-migrations`: индекс таблицы сессий адаптера для чтения по персонажу. Адаптер
  применяет его при старте, как и прежние changeset.

**Что делать.**

1. В каждом старте частного магазина из приложения (продажа, пакетная продажа, покупка), если
   `NxAppRules.current().privateStoreStartCooldownMinutes()` больше `0`, прочитайте
   `findLastStartedByCharacter(characterId, ActivityType.OFFLINE_PRIVATE_STORE)` и отклоните старт с `COOLDOWN` и
   `retryAt` = его `startedAt` плюс кулдаун, пока этот момент не наступил. Ждите future в своём потоке команды,
   никогда не в IO-пуле адаптера.
2. Ошибка чтения отклоняет старт как временно недоступный, а не как «предыдущего магазина нет».
3. Никогда не применяйте кулдаун к остановке: закрыть магазин можно всегда.
4. Переименуйте вызовы `findLastStarted(masterAccountId, activity)` в `findLastStartedByMasterAccount`, а обращения к
   `startCooldownMinutes` у `AppSettings` в `fishingStartCooldownMinutes`.
5. Поднимите `nx-gs-db-migrator-liquibase5` до 0.2.2: он приносит `nx-gs-db-migrations` 0.4.0 (changeset 0010).

## nx-gs-adapter-api 0.111.0, nx-gs-adapter-core 0.45.0: файл настроек приложения

**Что изменилось.** Настройки приложения сервера теперь принадлежат адаптеру: файл `l2nx-app.properties` (см.
[конфигурацию](/ru/adapter/configuration/#файл-настроек-приложения)), проверяется целиком и перечитывается без
перезапуска. Хост больше не поставляет и не публикует настройки. Хост, который реализует `OfflineSessionHost` или
вызывает `NxAppSessions`, должен адаптироваться в том же релизе, что поднимает api и core:

- `OfflineSessionHost.settings()` удалён; удалите реализацию.
- `OfflineSessionSettings` удалён. Его значения теперь ключи файла: порог возврата, срок хранения, размер пачки
  восстановления и пауза.
- `NxAppSessions.publishSettings` удалён: настройки публикует сам адаптер. Перестаньте его вызывать и уберите код
  хоста, собиравший `AppSettings`.
- У `OfflineSession` новое nullable-поле `returnThresholdMs`, фиксируемое при старте сессии; флаг `returnToOrigin` в
  `removeFromWorld` считается по нему.
- Новое: `NxAppSessions.findOpenByMasterAccount` и `findLastStarted`, а также `NxAppRules` (`NxAdapter.appRules()`,
  `ConnectContext.appRules()`, `CommandContext.appRules()`) для типизированных правил.

**Что делать.**

1. Удалите `settings()` из своего `OfflineSessionHost` и вызовы `publishSettings`.
2. Создайте `l2nx-app.properties` рядом с `l2nx.properties`, взяв за основу
   [эталонный файл](https://github.com/l2nx/nx-gs-adapter/blob/master/l2nx-app.properties), и перенесите в него прежние
   значения настроек. Все типы сессий по умолчанию выключены: включите те, что предлагает сервер.
3. Читайте правила (кулдауны, длительности, окна, пул точек) из `NxAppRules.current()` на каждой проверке, а не из
   собственной конфигурации.
4. Если вы сами создаёте `OfflineSession` (в том числе в тестах), передавайте новый `returnThresholdMs`.

Изменения схемы (nullable-колонка и индекс в таблице сессий адаптера) применяет мигратор адаптера при старте.

## nx-gs-adapter-api 0.110.0: контракт частных магазинов

**Что изменилось.** Команды и события частных магазинов переработаны. Хост, который обрабатывает команды
`StartPrivateStore*`, отказывает в открытии магазина или покупке либо читает события покупки, должен адаптироваться в
том же релизе, который обновляет api:

- Новая команда `StartPrivateStoreBuyCommand` открывает магазин скупки; её строки — `WantedLine`
  (`itemTemplateId`, `count`, `priceAdena`). `StartPrivateStoreSellCommand` и `StartPrivateStorePackageSellCommand`
  теперь наследуют новый `StartPrivateStoreSellingCommand`, в котором `getLines()` и `getSellerFeePercent()`; в общей
  базе `StartPrivateStoreCommand` их больше нет.
- У `DroppedLine` появился обязательный `lineIndex` (индекс с нуля в `lines` команды), а `itemId` стал nullable.
- `PrivateStoreFees`, `MAX_FEE_PERCENT` и `BuyFromPrivateStoreCommand.MAX_LINES` удалены: лимиты определяет
  платформа. Процент комиссии проверяется только на неотрицательность (комиссия продавца ещё и не более 100);
  слишком большую покупку отклоняйте с `TOO_MANY_LINES`.
- Классы-константы `WellKnown*` частных магазинов заменены enum-ами `PrivateStoreReason`, `DroppedLineReason` и
  `PrivateStoreMetadataKey`. `SellerFee` теперь `PrivateStoreFee`, а `PrivateStoreMetadata` читает комиссию продавца
  и покупателя из metadata события покупки.
- Метаданные покупки `source` теперь имя `SessionSource`: `CLIENT` или `APP` (раньше `in_game` или `remote`).
- Новые мягкие парсеры возвращают `null` для неизвестного токена: `SessionSource.fromToken` и `fromToken` новых
  enum-ов.

**Что делать.**

1. Замените удалённые константы и классы на перечисленные enum-ы и типы; `lines` команды продажи берите из
   `StartPrivateStoreSellingCommand`.
2. Заполняйте `lineIndex` в каждом сообщаемом `DroppedLine`.
3. Отправляйте `CLIENT` или `APP` в `source` покупки и читайте его через `SessionSource.fromToken`.
4. Обработайте `StartPrivateStoreBuyCommand`, чтобы поддержать магазины скупки.

## nx-gs-adapter-core 0.40.0: миграции схемы адаптера

**Что изменилось.** Адаптер теперь сам создаёт и обновляет свои таблицы `l2nx_*` в игровой базе до старта любого
модуля. Игровой сервер без мигратора схемы в classpath переходит в `FAILED` при старте.

**Что делать** на игровом сервере (логин-сервера это не касается):

1. Запускайте сервер на Java 17 или новее.
2. Добавьте [`nx-gs-db-migrator-liquibase5`](/ru/adapter/modules/nx-gs-db-migrator-liquibase5/) и
   `org.liquibase:liquibase-core` 5.x в runtime classpath — в том же релизе, который обновляет core.
3. Убедитесь, что зарегистрирован ровно один `JdbcConnectionSource` и что у его пользователя базы есть права на
   запись и DDL для таблиц `l2nx_*` и `CREATE` в схеме.
4. Уберите DDL таблиц `l2nx_*` из кода хоста, если он там был: теперь ими владеет адаптер. Существующая таблица
   `l2nx_command_receipts` принимается как есть, вместе с данными.
5. Если хост читает таблицы `l2nx_*` при своей загрузке до `NxAdapter.start()`, сначала вызовите
   `NxAdapter.migrateSchema()`.
