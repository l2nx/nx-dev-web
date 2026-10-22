---
title: Эксплуатация
description: Настройка, мониторинг, контейнер и перезапуск серверов логина и игры nx-l2.
---

Оба сервера работают на Spring Boot. Страница описывает, что оператор настраивает и за чем следит. Настройки логина —
ключи `l2nx.login.*` в `application.yaml`, сетевые настройки обоих серверов — `l2nx.network.*`, связь между
серверами — `spring.grpc.*` и `l2nx.gslink.*`; настройки игры остаются в `.ini`-файлах `config/`.

## Конфигурация

| Где                       | Что                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `config/*.ini`            | настройки игры, клиентские порты (только игра)                                                                                  |
| `config/application.yaml` | база данных, management-порт и адрес, логирование, `l2nx.login.*`, `l2nx.network.*`, GS-link (`spring.grpc.*`, `l2nx.gslink.*`) |
| переменные окружения      | переопределяют ключи Spring Boot из файла и из значений по умолчанию                                                            |

`config/application.yaml` лежит в дистрибутиве (рядом с `.ini`-файлами игрового сервера); Spring Boot читает его без дополнительных флагов,
он переопределяет встроенные значения по умолчанию. Переменные окружения сильнее файла: `SPRING_DATASOURCE_URL`,
`SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `SERVER_PORT`, `SERVER_ADDRESS`.

Общие значения по умолчанию обоих серверов:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/l2nx
    password: l2nx
server:
  address: 127.0.0.1
```

Пользователь и схема задаются для каждого сервера: `l2nx_login` и `login` у сервера логина, `l2nx_game` и `game` у
игрового (`spring.datasource.username`, `l2nx.database.schema`). Пул содержит 5 соединений на сервере логина и 20 на
игровом сервере (`spring.datasource.hikari.maximum-pool-size`). Пароль по умолчанию нужен только для локальной
разработки: задайте свой, прежде чем база станет доступна откуда-то ещё.

Сервер логина слушает по порту на каждый вариант клиентского протокола (`l2nx.login.client.ports`, список
`{port, variant}`; в поставке `2106` для `c621`, клиентов High Five). Его блокирующая работа (расшифровка учётных
данных, поиск аккаунта, проверка пароля) выполняется не больше чем `l2nx.login.client.max-concurrent-tasks` задачами
одновременно на все соединения (по умолчанию `32`); остальные ждут очереди.

Оба сервера берут сетевые лимиты и таймауты из `l2nx.network.*`; ключ с пометкой «игровой сервер» действует только на
игровом сервере. Значения по умолчанию подходят публичному серверу:

| Ключ                                                      | По умолчанию     | Смысл                                                                                                                                                          |
| --------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `l2nx.network.transport`                                  | `auto`           | `auto` (epoll в Linux, иначе NIO), `epoll`, `nio`, `io-uring`                                                                                                  |
| `l2nx.network.max-frame`                                  | `16KB`           | самый большой пакет от клиента                                                                                                                                 |
| `l2nx.network.read-timeout`                               | `120s`           | молчание до авторизации, после которого соединение закрывается (игровой сервер: пока аккаунт не принят)                                                        |
| `l2nx.network.handshake-timeout`                          | `10s`            | время от подключения до версии протокола (игровой сервер) или `AuthGameGuard` (сервер логина)                                                                  |
| `l2nx.network.auth-timeout`                               | `60s`            | время от подключения до завершённой авторизации на сервере логина или игровом сервере                                                                          |
| `l2nx.network.ping-interval`                              | `30s`            | игровой сервер, после того как аккаунт принят: молчание, после которого клиенту уходит ping                                                                    |
| `l2nx.network.ping-misses`                                | `3`              | игровой сервер: неотвеченных ping подряд, после которых соединение закрывается                                                                                 |
| `l2nx.network.inbound-queue-limit`                        | `256`            | игровой сервер: пакетов одного клиента в ожидании; ещё один закрывает соединение                                                                               |
| `l2nx.network.packets-per-second`                         | `200`            | игровой сервер: устойчивый поток пакетов в секунду от одного клиента, не больше `1000000000`; burst до `inbound-queue-limit`                                   |
| `l2nx.network.packets-per-drain`                          | `16`             | игровой сервер: пакетов одного клиента за один ход, прежде чем очередь дойдёт до других клиентов                                                               |
| `l2nx.network.max-concurrent-drains`                      | `32`             | игровой сервер: клиентов, чьи пакеты выполняются одновременно                                                                                                  |
| `l2nx.network.decode-error-limit.count` / `.window`       | `10` / `60s`     | игровой сервер: битых пакетов в игре и сбойных пакетов на любом этапе, допустимых для клиента за окно, прежде чем соединение закроется                         |
| `l2nx.network.connections-per-ip`                         | `10`             | одновременных соединений с одного адреса                                                                                                                       |
| `l2nx.network.accept-per-ip-per-second`                   | `5`              | новых соединений в секунду с одного адреса                                                                                                                     |
| `l2nx.network.max-connections`                            | `10000`          | одновременных соединений на сервер                                                                                                                             |
| `l2nx.network.outbound-limit`                             | `1MB`            | неотправленных данных на соединение до его закрытия                                                                                                            |
| `l2nx.network.worker-threads`                             | `0`              | потоки event loop; `0` берёт удвоенное число доступных процессоров                                                                                             |
| `l2nx.network.write-buffer-low` / `write-buffer-high`     | `32KB` / `128KB` | объём неотправленных данных соединения, выше которого клиент считается медленным (`high`) и ниже которого восстанавливается (`low`); см. `slow-client-timeout` |
| `l2nx.network.slow-client-timeout`                        | `10s`            | сколько соединение может держаться выше `write-buffer-high`, прежде чем оно закроется                                                                          |
| `l2nx.network.shutdown-quiet-period` / `shutdown-timeout` | `2s` / `15s`     | при остановке: тишина перед остановкой event loop и максимум времени, за который клиенты получают прощальное сообщение                                         |

После авторизации сессия логина больше не ограничена `read-timeout`: она остаётся открытой не дольше 5 минут в сумме,
затем сервер сообщает клиенту, что сессия истекла, и закрывает её, так что клиент возвращается на экран входа.

## Связь сервера логина и игрового сервера

Игровой сервер регистрируется на сервере логина через GS-link — gRPC stream на порту `9014` сервера логина. Обоим
серверам нужен один и тот же secret длиной не менее 32 символов (256 бит), из печатных символов ASCII без пробелов;
без него или с более коротким они не запускаются. Сгенерируйте его командой `openssl rand -base64 32` (44 символа) и
передайте через переменную окружения:

```sh
export L2NX_GSLINK_SECRET=<сгенерированный secret>
```

Сервер логина слушает `127.0.0.1:9014` (`spring.grpc.server.address` и `.port`), игровой сервер подключается к
`static://127.0.0.1:9014` (`spring.grpc.client.channel.login.target`), поэтому двум серверам на одном хосте больше
ничего не нужно. Без TLS связь работает только на loopback. Любой другой адрес требует TLS, иначе сервер не
запустится: secret передавался бы открытым текстом. TLS берётся из Spring Boot SSL bundle; игровой сервер проверяет
сертификат сервера логина и имя хоста, к которому подключается, и не запускается с `bypass-certificate-validation`:

```yaml
# сервер логина, config/application.yaml
spring:
  ssl:
    bundle:
      pem:
        gslink:
          keystore:
            certificate: file:config/gslink.crt
            private-key: file:config/gslink.key
  grpc:
    server:
      address: 0.0.0.0
      ssl:
        bundle: gslink
```

```yaml
# игровой сервер, config/application.yaml
spring:
  ssl:
    bundle:
      pem:
        gslink:
          truststore:
            certificate: file:config/gslink-ca.crt
  grpc:
    client:
      channel:
        login:
          target: static://login.example.org:9014
          ssl:
            bundle: gslink
```

`gslink-ca.crt` — сертификат центра, подписавшего сертификат сервера логина, или сам этот сертификат, если он
self-signed (как его создать, показано в разделе [Docker](#docker)).

Обе стороны отправляют gRPC keepalive ping каждые 15 секунд и отключают сторону, которая не ответила ещё за 10
(`spring.grpc.server.keepalive.*`, `spring.grpc.client.channel.login.keepalive.*`). Игровой сервер открывает новый
stream через 1 секунду после обрыва, удваивая паузу до 30 секунд (`l2nx.gslink.reconnect-delay.initial` и `.max`).
Игровой сервер, который регистрируется с hex id живого stream, получает отказ, пока тот stream не завершится;
мёртвый stream закрывает keepalive примерно за 25 секунд. При остановке сервер логина
завершает все stream и ждёт их до 15 секунд (`spring.grpc.server.shutdown.grace-period`). На порту сервера логина
также работает стандартный gRPC health check, без secret.

## База данных

Серверам нужен PostgreSQL 18 или новее. Каждый серверный процесс владеет одной схемой в общей базе и ролью, которая
владеет только этой схемой. Роли и схемы создаёте вы сами, как администратор базы данных; сервер их не создаёт. Если
схемы нет, сервер останавливается при старте и называет схему и роль, которые нужно создать.

```sql
CREATE ROLE l2nx_login LOGIN PASSWORD 'change-me';
CREATE SCHEMA login AUTHORIZATION l2nx_login;

CREATE ROLE l2nx_game LOGIN PASSWORD 'change-me';
CREATE SCHEMA game AUTHORIZATION l2nx_game;
```

Таблицы серверы создают при старте через Liquibase внутри своей схемы; вручную выполнять SQL не нужно. Между схемами
нет ни чтения, ни внешних ключей, поэтому сервер логина можно вынести в отдельную базу или на другой хост, изменив его
`spring.datasource.url`.

Одну базу могут делить несколько игровых серверов. Дайте каждому свою схему и роль (`game_1` и `l2nx_game_1`, `game_2`
и `l2nx_game_2`, ...) и задайте схему этого сервера через `l2nx.database.schema` (переменная окружения
`L2NX_DATABASE_SCHEMA`) вместе с `spring.datasource.username`. Имя схемы соответствует `[a-z_][a-z0-9_]{0,62}`. Имена
персонажей и кланов уникальны в пределах игровой схемы; игровые серверы с общей базой имён не делят.

Логины аккаунтов, имена персонажей и кланов сравниваются без учёта регистра через ICU collation, которую каждая схема
создаёт для себя.

**Обновление серверов.** До версии 1.0 у каждого сервера одна baseline-схема, и её правят на месте, поэтому переход
между версиями до 1.0 означает создание базы заново; об этом сказано в release notes. Ошибка checksum
Liquibase при старте означает именно это. Начиная с 1.0 изменения приходят новыми миграциями, которые выполняются при
старте и идут только вперёд: перед обновлением сделайте резервную копию базы, downgrade не поддерживается.

**Обновление PostgreSQL или библиотеки ICU.** Новая версия ICU может упорядочивать значения иначе, и уникальный индекс,
построенный по старому порядку, перестаёт быть верным. После такого обновления выполните для каждой схемы от имени её
владельца:

```sql
REINDEX SCHEMA game;
ALTER COLLATION game.case_insensitive REFRESH VERSION;
```

и то же для `login`. Пока этого не сделано, PostgreSQL предупреждает в логе о несовпадении версии collation.

### Game loop (игровой сервер)

Игровой сервер ведёт мир на циклах партиций. Их настраивают ключи `l2nx.engine.*` в `application.yaml`; значения по
умолчанию — отправная точка, их подбирают под нагрузкой.

| Ключ                               | По умолчанию        | Значение                                                                                                      |
| ---------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `l2nx.engine.pass-min`             | `5ms`               | минимальный интервал между pass ради ввода; таймеры и системы его не ждут                                     |
| `l2nx.engine.pass-budget`          | `50ms`              | более долгий pass считается и пишется в лог с разбивкой по фазам                                              |
| `l2nx.engine.trigger-depth`        | `8`                 | поколений порождённой работы, обрабатываемых за один pass                                                     |
| `l2nx.engine.packets-per-pass`     | `16`                | сколько элементов за pass отдаёт один готовый источник ввода                                                  |
| `l2nx.engine.overdue-per-pass`     | `4096`              | сколько overdue-таймеров timer wheel выполняет за pass; остальные ждут следующего pass                        |
| `l2nx.engine.owed-ticks-per-pass`  | `10`                | сколько тиков за pass нагоняет одна опоздавшая периодическая задача                                           |
| `l2nx.engine.blocked-pass-warning` | `2s`                | более долгий pass пишет в лог stack потока цикла, раз на каждое кратное значение                              |
| `l2nx.engine.blocked-pass-exit`    | не задан (выключен) | pass дольше этого завершает сервер, чтобы supervisor его перезапустил; значение больше `blocked-pass-warning` |

Длительности — целое число миллисекунд, не меньше `1ms`; счётчики положительны. Неверное значение останавливает сервер
при запуске. Остановка циклов ограничена стандартным `spring.lifecycle.timeout-per-shutdown-phase` (по умолчанию 30
секунд).

Watchdog-поток проверяет текущий pass каждые 500 мс. Pass, который не заканчивается (бесконечный цикл в скрипте),
замораживает мир, а из замороженного цикла мир не сохранить: `blocked-pass-exit` жертвует изменениями с последнего
сохранения ради доступности, поэтому по умолчанию он выключен. Выход останавливает сервер штатно, и замороженный цикл
задерживает эту остановку не дольше `timeout-per-shutdown-phase`. Пока сервер останавливается, stack
заблокированного pass (например, сохранения, зависшего на базе данных) по-прежнему пишется в лог, но выход он не
вызывает. Startup pass, который загружает мир, не отслеживается.

### Background tasks (игровой сервер)

Работа, которая не касается мира, например чтение очереди custom mail из базы данных или замер загрузки CPU и памяти
для precautionary restart, идёт вне цикла мира на стандартных task scheduler и executor Spring Boot; её результат
возвращается в цикл мира. Их настраивают стандартные ключи `spring.task.*`:

| Ключ                                        | По умолчанию             | Значение                                              |
| ------------------------------------------- | ------------------------ | ----------------------------------------------------- |
| `spring.task.scheduling.pool.size`          | `2`                      | потоков для отложенной и периодической фоновой работы |
| `spring.task.scheduling.thread-name-prefix` | `l2nx-background-`       | префикс имени потоков scheduler                       |
| `spring.task.execution.pool.*`              | по умолчанию Spring Boot | executor для немедленной фоновой работы               |
| `spring.task.execution.thread-name-prefix`  | `l2nx-background-exec-`  | префикс имени потоков executor                        |

`spring.threads.virtual.enabled` не задавайте: с virtual threads Spring Boot строит scheduler, у которого
периодические запуски могут перекрываться, и этот ключ переключает заодно все остальные executor сервера.

## Health и метрики

Каждый сервер поднимает небольшой HTTP-сервер, который отдаёт только Spring Boot Actuator. Он слушает `127.0.0.1`: порт
`8106` у сервера логина, `8777` у игрового. Аутентификации нет, защита — адрес loopback. Не публикуйте порт в публичную
сеть.

| Endpoint               | Назначение                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `/actuator/health`     | liveness и readiness (`/health/liveness`, `/health/readiness`); readiness проверяет базу данных |
| `/actuator/info`       | сведения о сборке, git, Java, ОС и процессе                                                     |
| `/actuator/prometheus` | метрики для сбора Prometheus                                                                    |
| `/actuator/loggers`    | чтение и изменение уровней логирования на ходу, без перезапуска                                 |
| `/actuator/threaddump` | thread dump без `jstack`                                                                        |

Пока загружается датапак, liveness равен `UP`, а readiness — `OUT_OF_SERVICE`; readiness становится `UP`, когда сервер
принимает клиентов. При остановке он первым переходит в состояние refusing traffic.

Затем каждому подключённому клиенту сообщается об остановке до закрытия соединения: игровой сервер отправляет сообщение
о закрытии сервера (в том числе игрокам на экране выбора персонажа), и клиент High Five показывает «You have been
disconnected»; сервер логина отправляет отказ во входе с причиной «техническое обслуживание», который клиент показывает
на экране логина и в списке серверов как «We are currently undergoing game server maintenance». На доставку клиентам
отводится до `l2nx.network.shutdown-timeout` (15 секунд).

```sh
curl -s http://127.0.0.1:8777/actuator/health/readiness
curl -s -X POST -H 'Content-Type: application/json' -d '{"configuredLevel":"DEBUG"}' \
  http://127.0.0.1:8777/actuator/loggers/org.example
```

Метрики — стандартные для Spring Boot (JVM, процесс, система, события лога, `hikaricp.*`, `tomcat.*`, `executor.*` для
пулов потоков) с тегом `application`, плюс `l2nx.network.*` (соединения, байты, отброшенное, закрытия по причинам),
`grpc.server.*` / `grpc.client.*` для GS-link, `l2nx.players.online`, `l2nx.session.queue.depth` (число элементов во
входной очереди клиента после каждого присланного им пакета, одна histogram по всем клиентам для p99 и максимума) и, на игровом сервере, метрики циклов `l2nx.engine.*` (время pass и фаз, pass сверх
бюджета, `l2nx.engine.pass.running` (сколько секунд уже идёт текущий pass, 0 между pass, так что зависший pass виден до его конца), глубина inbox, таймеры, сбои, вызовы с потока, который не владеет циклом; `l2nx.engine.jdbc.on.loop` — время
вызовов JDBC на потоках циклов, пока работа с базой не уйдёт с цикла; `WARN` называет вызывающий код раз в минуту на каждое место вызова) и `l2nx.legacy.packet`
(время выполнения клиентского пакета).

## Логи

Сервер пишет в консоль и в файлы в `./log` относительно корня дистрибутива:

- `server.log` — всё, что видно в консоли;
- `error.log` — события уровня `WARN` и выше;
- по файлу на канал: `accounting`, `audit`, `chat`, `enchant.items`, `enchant.skills`, `gmaudit`, `item`, `olympiad`;
  создаются при первом использовании.

Файлы ротируются раз в сутки и при 100 МБ и сжимаются; сжатые файлы старше 30 дней удаляются. Чтобы заменить
конфигурацию, задайте стандартный `logging.config`. Для JSON в консоли установите `logging.structured.format.console` в
`ecs`, `logstash` или `gelf`.

## Docker

Образ собирается из установленного дистрибутива, по одному на сервер:

```sh
./gradlew :chronicles:high-five:boot:installDist
docker build -t l2nx/game-server chronicles/high-five/boot

./gradlew :login:boot:installDist
docker build -t l2nx/login-server login/boot
```

- Сервер работает от непривилегированного пользователя из корня дистрибутива, поэтому `./config`, `./data` и `./log`
  разрешаются так же, как в обычном дистрибутиве.
- Management-порт внутри контейнера слушает все интерфейсы. По умолчанию ничего не публикуется; публикуйте его только на
  доверенный адрес.
- `HEALTHCHECK` опрашивает `/actuator/health/readiness`. Игровому серверу нужен start period в несколько минут,
  пока загружается датапак.
- Геодата — volume: примонтируйте файлы в `/opt/game-server/data/geodata`.
- Остановка сохраняет всех игроков онлайн и может занять время. Задайте контейнеру таймаут остановки заметно больше
  этого времени (`docker stop --time 120`, `stop_grace_period` в Compose); Docker по умолчанию даёт 10 секунд, этого мало.
  Сервер логина ждёт завершения stream GS-link до 15 секунд, поэтому ему тоже нужен таймаут остановки больше.

Loopback контейнера недоступен из другого контейнера, поэтому gRPC-сервер сервера логина слушает интерфейс
контейнера (`0.0.0.0`) и, как для любого адреса кроме loopback, требует TLS: без SSL bundle сервер не запустится.
Один раз, вне контейнеров, создайте self-signed сертификат с именем хоста, к которому подключается игровой сервер:

```sh
openssl req -x509 -newkey rsa:3072 -nodes -days 825 \
  -keyout gslink.key -out gslink.crt \
  -subj "/CN=login-host" -addext "subjectAltName=DNS:login-host"
```

`CN` и subject alternative name должны совпадать с хостом в `SPRING_GRPC_CLIENT_CHANNEL_LOGIN_TARGET`, потому что
игровой сервер проверяет имя хоста. Образ работает от непривилегированного пользователя, поэтому `gslink.key` должен
быть доступен для чтения его uid (его выводит `docker run --rm --entrypoint id l2nx/login-server -u`). Примонтируйте
`gslink.key` и `gslink.crt` только для чтения в контейнер сервера логина и один `gslink.crt` в контейнер игрового
сервера (self-signed сертификат сам себе trust anchor). Оба контейнера получают один и тот же `L2NX_GSLINK_SECRET`,
а SSL bundle задаётся свойствами из [раздела о связи](#связь-сервера-логина-и-игрового-сервера) через переменные
окружения:

```sh
docker run -d --name login-server --stop-timeout 30 --restart on-failure \
  -e SPRING_DATASOURCE_URL='jdbc:postgresql://db-host:5432/l2nx' \
  -e SPRING_DATASOURCE_USERNAME=l2nx_login -e SPRING_DATASOURCE_PASSWORD=change-me \
  -e L2NX_GSLINK_SECRET="$L2NX_GSLINK_SECRET" \
  -e SPRING_GRPC_SERVER_ADDRESS=0.0.0.0 \
  -e SPRING_GRPC_SERVER_SSL_BUNDLE=gslink \
  -e SPRING_SSL_BUNDLE_PEM_GSLINK_KEYSTORE_CERTIFICATE=file:/opt/login-server/tls/gslink.crt \
  -e SPRING_SSL_BUNDLE_PEM_GSLINK_KEYSTORE_PRIVATEKEY=file:/opt/login-server/tls/gslink.key \
  -v "$PWD/gslink.crt:/opt/login-server/tls/gslink.crt:ro" \
  -v "$PWD/gslink.key:/opt/login-server/tls/gslink.key:ro" \
  -p 2106:2106 -p 9014:9014 \
  l2nx/login-server

docker run -d --name game-server --stop-timeout 120 --restart on-failure \
  -e SPRING_DATASOURCE_URL='jdbc:postgresql://db-host:5432/l2nx' \
  -e SPRING_DATASOURCE_USERNAME=l2nx_game -e SPRING_DATASOURCE_PASSWORD=change-me \
  -e L2NX_GSLINK_SECRET="$L2NX_GSLINK_SECRET" \
  -e SPRING_GRPC_CLIENT_CHANNEL_LOGIN_TARGET=static://login-host:9014 \
  -e SPRING_GRPC_CLIENT_CHANNEL_LOGIN_SSL_BUNDLE=gslink \
  -e SPRING_SSL_BUNDLE_PEM_GSLINK_TRUSTSTORE_CERTIFICATE=file:/opt/game-server/tls/gslink.crt \
  -v "$PWD/gslink.crt:/opt/game-server/tls/gslink.crt:ro" \
  -v "$PWD/geodata:/opt/game-server/data/geodata" -p 7777:7777 \
  l2nx/game-server
```

Клиентские порты игрового сервера по-прежнему задаются в `.ini`-файлах, поэтому пару логина и игры в Compose пока
настроить нельзя; запускайте их как дистрибутивы.

## Перезапуск

Процесс сам себя не перезапускает. Он завершается с кодом, а решение принимает супервизор.

| Код выхода | Значение                               | Супервизор       |
| ---------- | -------------------------------------- | ---------------- |
| 0          | остановлен намеренно (shutdown)        | не перезапускает |
| 1          | сбой запуска или падение               | перезапускает    |
| 2          | запрошен рестарт (команда, расписание) | перезапускает    |
| 143        | остановлен по SIGTERM                  | не перезапускает |

Docker: `--restart on-failure` (или `restart: on-failure` в Compose) перезапускает при 1 и 2 и не трогает `docker stop`.

systemd:

```ini
[Service]
WorkingDirectory=/opt/game-server
EnvironmentFile=/opt/game-server/gslink.env
ExecStart=/opt/game-server/bin/game-server
Restart=on-failure
RestartForceExitStatus=2
SuccessExitStatus=143
TimeoutStopSec=120
```

`SuccessExitStatus=143` делает `systemctl stop` штатной остановкой; `RestartForceExitStatus=2` перезапускает по
запрошенному рестарту независимо от остальных настроек. `gslink.env` содержит `L2NX_GSLINK_SECRET=…` и может быть
доступен для чтения только root, потому что systemd читает его до запуска сервера; юнит сервера логина подключает тот
же файл.
