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
