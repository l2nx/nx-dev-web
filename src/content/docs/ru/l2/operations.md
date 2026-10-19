---
title: Эксплуатация
description: Настройка, мониторинг, контейнер и перезапуск серверов логина и игры nx-l2.
---

Оба сервера работают на Spring Boot. Страница описывает, что оператор настраивает и за чем следит. Настройки логина —
ключи `l2nx.login.*` в `application.yaml`; настройки игры остаются в `.ini`-файлах `config/`.

## Конфигурация

| Где                       | Что                                                                   |
| ------------------------- | --------------------------------------------------------------------- |
| `config/*.ini`            | настройки игры, размеры пулов потоков, клиентские порты (только игра) |
| `config/application.yaml` | база данных, порт и адрес управления, логирование, `l2nx.login.*`     |
| переменные окружения      | переопределяют ключи Spring Boot из файла и из значений по умолчанию  |

`config/application.yaml` лежит в дистрибутиве (рядом с `.ini`-файлами игрового сервера); Spring Boot читает его без дополнительных флагов,
он переопределяет встроенные значения по умолчанию. Переменные окружения сильнее файла: `SPRING_DATASOURCE_URL`,
`SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `SERVER_PORT`, `SERVER_ADDRESS`.

Общие значения по умолчанию обоих серверов:

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/l2nx?allowPublicKeyRetrieval=true&useSSL=false
    username: l2nx
    password: l2nx
server:
  address: 127.0.0.1
```

Пул содержит 5 соединений на сервере логина и 100 на игровом сервере
(`spring.datasource.hikari.maximum-pool-size`). Пароль по умолчанию нужен только для локальной разработки: задайте
свой, прежде чем база станет доступна откуда-то ещё.

## Состояние и метрики

Каждый сервер поднимает небольшой HTTP-сервер, который отдаёт только Spring Boot Actuator. Он слушает `127.0.0.1`: порт
`8106` у сервера логина, `8777` у игрового. Аутентификации нет, защита — адрес loopback. Не публикуйте порт в публичную
сеть.

| Endpoint               | Назначение                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `/actuator/health`     | liveness и readiness (`/health/liveness`, `/health/readiness`); readiness проверяет базу данных |
| `/actuator/info`       | сведения о сборке, git, Java, ОС и процессе                                                     |
| `/actuator/prometheus` | метрики для сбора Prometheus                                                                    |
| `/actuator/loggers`    | чтение и изменение уровней логирования на ходу, без перезапуска                                 |
| `/actuator/threaddump` | дамп потоков без `jstack`                                                                       |

Пока загружается датапак, liveness равен `UP`, а readiness — `OUT_OF_SERVICE`; readiness становится `UP`, когда сервер
принимает клиентов. При остановке он первым переходит в состояние отказа от трафика.

```sh
curl -s http://127.0.0.1:8777/actuator/health/readiness
curl -s -X POST -H 'Content-Type: application/json' -d '{"configuredLevel":"DEBUG"}' \
  http://127.0.0.1:8777/actuator/loggers/org.example
```

Метрики — стандартные для Spring Boot (JVM, процесс, система, события лога, `hikaricp.*`, `tomcat.*`, `executor.*` для
пулов потоков) с тегом `application`, плюс `l2nx.players.online`.

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
- Порт управления внутри контейнера слушает все интерфейсы. По умолчанию ничего не публикуется; публикуйте его только на
  доверенный адрес.
- `HEALTHCHECK` опрашивает `/actuator/health/readiness`. Игровому серверу нужен стартовый период в несколько минут,
  пока загружается датапак.
- Геодата — том: примонтируйте файлы в `/opt/game-server/data/geodata`.
- Остановка сохраняет всех игроков онлайн и может занять время. Задайте контейнеру таймаут остановки заметно больше
  этого времени (`docker stop --time 120`, `stop_grace_period` в Compose); Docker по умолчанию даёт 10 секунд, этого мало.

```sh
docker run -d --name game-server --stop-timeout 120 --restart on-failure \
  -e SPRING_DATASOURCE_URL='jdbc:mysql://db-host:3306/l2nx?allowPublicKeyRetrieval=true&useSSL=false' \
  -e SPRING_DATASOURCE_USERNAME=l2nx -e SPRING_DATASOURCE_PASSWORD=change-me \
  -v "$PWD/geodata:/opt/game-server/data/geodata" -p 7777:7777 \
  l2nx/game-server
```

Клиентские порты игрового сервера и его связь с логином задаются в `.ini`-файлах, поэтому пару логина и игры в Compose пока настроить
нельзя; запускайте их как дистрибутивы.

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
ExecStart=/opt/game-server/bin/game-server
Restart=on-failure
RestartForceExitStatus=2
SuccessExitStatus=143
TimeoutStopSec=120
```

`SuccessExitStatus=143` делает `systemctl stop` штатной остановкой; `RestartForceExitStatus=2` перезапускает по
запрошенному рестарту независимо от остальных настроек.
