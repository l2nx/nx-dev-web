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
