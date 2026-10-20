---
title: Operations
description: Configure, monitor, containerize and restart the nx-l2 login and game servers.
---

Both servers run on Spring Boot. This page covers what an operator sets and watches. The login settings are
`l2nx.login.*` keys of `application.yaml`, its network settings `l2nx.network.*`; the game settings stay in the `.ini`
files of `config/`.

## Configuration

| Where                     | What                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `config/*.ini`            | game settings, thread pool sizes, client ports (game server only)                        |
| `config/application.yaml` | database, management port and address, logging, `l2nx.login.*`, `l2nx.network.*` (login) |
| environment variables     | override the Spring Boot keys of the file and of the built-in defaults                   |

`config/application.yaml` sits in the distribution (next to the `.ini` files of the game server); Spring Boot reads it without extra flags and
it overrides the built-in defaults. Environment variables win over the file: `SPRING_DATASOURCE_URL`,
`SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `SERVER_PORT`, `SERVER_ADDRESS`.

The shared defaults of both servers:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/l2nx
    password: l2nx
server:
  address: 127.0.0.1
```

The user and the schema are set per server: `l2nx_login` and `login` for the login server, `l2nx_game` and `game` for
the game server (`spring.datasource.username`, `l2nx.database.schema`). The pool holds 5 connections on the login
server and 100 on the game server (`spring.datasource.hikari.maximum-pool-size`). The default password is for local
development only: set your own before the database is reachable from anywhere else.

The login server listens on one port per client protocol variant (`l2nx.login.client.ports`, a list of
`{port, variant}`; the shipped one is `2106` for `c621`, High Five clients). Its blocking work (decrypting the
credentials, the account lookup, the password check) runs at most `l2nx.login.client.max-concurrent-tasks` tasks at
once across all connections (default `32`); the others wait their turn. Its network limits and timeouts are
`l2nx.network.*`; the defaults suit a public server:

| Key                                     | Default | Meaning                                                            |
| --------------------------------------- | ------- | ------------------------------------------------------------------ |
| `l2nx.network.transport`                | `auto`  | `auto` (epoll on Linux, NIO elsewhere), `epoll`, `nio`, `io-uring` |
| `l2nx.network.max-frame`                | `16KB`  | largest packet a client may send                                   |
| `l2nx.network.read-timeout`             | `120s`  | silence before the login is authenticated that closes a connection |
| `l2nx.network.connections-per-ip`       | `10`    | concurrent connections from one address                            |
| `l2nx.network.accept-per-ip-per-second` | `5`     | new connections per second from one address                        |
| `l2nx.network.max-connections`          | `10000` | concurrent connections per server                                  |
| `l2nx.network.outbound-limit`           | `1MB`   | unsent data per connection before it is closed                     |

After authentication a login session is no longer bound by `read-timeout`: it stays open for at most 5 minutes in
total, then the server closes it.

## Database

The servers need PostgreSQL 18 or newer. Every server process owns one schema in a shared database, and a role that
owns only that schema. Create the roles and schemas yourself, as a database administrator; a server never creates
them. If the schema is missing, the server stops at start and names the schema and the role to create.

```sql
CREATE ROLE l2nx_login LOGIN PASSWORD 'change-me';
CREATE SCHEMA login AUTHORIZATION l2nx_login;

CREATE ROLE l2nx_game LOGIN PASSWORD 'change-me';
CREATE SCHEMA game AUTHORIZATION l2nx_game;
```

The servers create their tables at start with Liquibase, inside their own schema; there is no SQL to run by hand.
Nothing reads across schemas and there are no foreign keys between them, so the login server can move to its own
database or host by changing its `spring.datasource.url`.

Several game servers can share one database. Give each its own schema and role (`game_1` and `l2nx_game_1`, `game_2`
and `l2nx_game_2`, ...) and set the schema on that server with `l2nx.database.schema` (environment variable
`L2NX_DATABASE_SCHEMA`) together with `spring.datasource.username`. A schema name matches `[a-z_][a-z0-9_]{0,62}`.
Character and clan names are unique within a game schema; game servers that share a database do not share names.

Account logins, character names and clan names are compared without regard to case, through an ICU collation that
each schema creates for itself.

**Upgrading the servers.** Before 1.0 each server has one baseline schema that is edited in place, so moving between
pre-1.0 versions means creating the database anew; the release notes say when. A Liquibase checksum error at start
means exactly this. From 1.0 on, changes arrive as new migrations that run at start and only move forward: back up the
database before you upgrade, a downgrade is not supported.

**Upgrading PostgreSQL or its ICU library.** A new ICU version can order collated values differently, and a unique
index built under the old order may then be wrong. After such an upgrade, run for each schema, as a user that owns it:

```sql
REINDEX SCHEMA game;
ALTER COLLATION game.case_insensitive REFRESH VERSION;
```

and the same for `login`. PostgreSQL warns about a collation version mismatch in its log until you do.

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
for the thread pools), tagged with `application`, plus `l2nx.network.*` (connections, bytes, drops, closes by reason)
and `l2nx.players.online`.

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
  -e SPRING_DATASOURCE_URL='jdbc:postgresql://db-host:5432/l2nx' \
  -e SPRING_DATASOURCE_USERNAME=l2nx_game -e SPRING_DATASOURCE_PASSWORD=change-me \
  -v "$PWD/geodata:/opt/game-server/data/geodata" -p 7777:7777 \
  l2nx/game-server
```

The game server's client ports and its link to the login server are set in the `.ini` files, so a login and game pair cannot yet be
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
