---
title: Operations
description: Configure, monitor, containerize and restart the nx-l2 login and game servers.
---

Both servers run on Spring Boot. This page covers what an operator sets and watches. The game and login settings
themselves stay in the `.ini` files of `config/`.

## Configuration

| Where                     | What                                                                   |
| ------------------------- | ---------------------------------------------------------------------- |
| `config/*.ini`            | game and login settings, thread pool sizes, client ports               |
| `config/application.yaml` | database, management port and address, logging, everything Spring Boot |
| environment variables     | override the Spring Boot keys of the file and of the built-in defaults |

`config/application.yaml` sits next to the `.ini` files in the distribution; Spring Boot reads it without extra flags and
it overrides the built-in defaults. Environment variables win over the file: `SPRING_DATASOURCE_URL`,
`SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `SERVER_PORT`, `SERVER_ADDRESS`.

The shared defaults of both servers:

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/l2nx?allowPublicKeyRetrieval=true&useSSL=false
    username: l2nx
    password: l2nx
server:
  address: 127.0.0.1
```

The pool holds 5 connections on the login server and 100 on the game server
(`spring.datasource.hikari.maximum-pool-size`). The default password is for local development only: set your own
before the database is reachable from anywhere else.

## Health and metrics

Each server runs a small HTTP server that serves Spring Boot Actuator and nothing else. It listens on `127.0.0.1`:
port `8106` for the login server, `8777` for the game server. There is no authentication; the protection is the
loopback address. Do not publish the port to a public network.

| Endpoint               | Purpose                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `/actuator/health`     | liveness and readiness (`/health/liveness`, `/health/readiness`); readiness checks the database |
| `/actuator/info`       | build, git, Java, OS and process information                                                    |
| `/actuator/prometheus` | metrics for a Prometheus scrape                                                                 |
| `/actuator/loggers`    | read and change log levels at runtime, without a restart                                        |
| `/actuator/threaddump` | thread dump without `jstack`                                                                    |

While the datapack loads, liveness is `UP` and readiness is `OUT_OF_SERVICE`; readiness turns `UP` when the server
accepts clients. On shutdown it turns to refusing traffic first.

```sh
curl -s http://127.0.0.1:8777/actuator/health/readiness
curl -s -X POST -H 'Content-Type: application/json' -d '{"configuredLevel":"DEBUG"}' \
  http://127.0.0.1:8777/actuator/loggers/org.example
```

Metrics are the standard Spring Boot ones (JVM, process, system, log events, `hikaricp.*`, `tomcat.*`, `executor.*`
for the thread pools), tagged with `application`, plus `l2nx.players.online`.

## Logs

The server writes to the console and to files in `./log` relative to the distribution root:

- `server.log`: everything the console shows;
- `error.log`: events at `WARN` and above;
- one file per channel: `accounting`, `audit`, `chat`, `enchant.items`, `enchant.skills`, `gmaudit`, `item`,
  `olympiad`, created on first use.

Files roll daily and at 100 MB and are compressed; compressed files older than 30 days are deleted. To replace the
configuration, set the standard `logging.config`. For JSON on the console set `logging.structured.format.console` to
`ecs`, `logstash` or `gelf`.

## Docker

The image is built from the installed distribution, one per server:

```sh
./gradlew :chronicles:high-five:boot:installDist
docker build -t l2nx/game-server chronicles/high-five/boot

./gradlew :login:boot:installDist
docker build -t l2nx/login-server login/boot
```

- The server runs as a non-root user from the distribution root, so `./config`, `./data` and `./log` resolve as in a
  plain distribution.
- The management port listens on all interfaces inside the container. Nothing is published by default; publish it only
  to an address you trust.
- `HEALTHCHECK` polls `/actuator/health/readiness`. The game server needs a start period of minutes while the datapack
  loads.
- Geodata is a volume: mount your files at `/opt/game-server/data/geodata`.
- Stopping saves every online player and may take a while. Give the container a stop timeout well above that time
  (`docker stop --time 120`, Compose `stop_grace_period`); the Docker default of 10 seconds is not enough.

```sh
docker run -d --name game-server --stop-timeout 120 --restart on-failure \
  -e SPRING_DATASOURCE_URL='jdbc:mysql://db-host:3306/l2nx?allowPublicKeyRetrieval=true&useSSL=false' \
  -e SPRING_DATASOURCE_USERNAME=l2nx -e SPRING_DATASOURCE_PASSWORD=change-me \
  -v "$PWD/geodata:/opt/game-server/data/geodata" -p 7777:7777 \
  l2nx/game-server
```

The client ports and the link between the servers are set in the `.ini` files, so a login and game pair cannot yet be
configured in Compose; run them as distributions until then.

## Restart

The process never restarts itself. It exits with a code, and the supervisor decides.

| Exit code | Meaning                               | Supervisor       |
| --------- | ------------------------------------- | ---------------- |
| 0         | stopped on purpose (shutdown)         | does not restart |
| 1         | startup failure or crash              | restarts         |
| 2         | restart requested (command, schedule) | restarts         |
| 143       | stopped by SIGTERM                    | does not restart |

Docker: `--restart on-failure` (or `restart: on-failure` in Compose) restarts on 1 and 2 and leaves `docker stop`
alone.

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

`SuccessExitStatus=143` makes `systemctl stop` a clean stop; `RestartForceExitStatus=2` restarts on a requested restart
whatever the other settings say.
