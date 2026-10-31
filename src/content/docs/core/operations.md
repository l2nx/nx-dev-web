---
title: Operations
description: Configure, monitor, containerize and restart the nx-l2 login and game servers.
---

Both servers run on Spring Boot. This page covers what an operator sets and watches. The login settings are
`l2nx.login.*` keys of `application.yaml`, the network settings of both servers `l2nx.network.*`, the link between
the servers `spring.grpc.*` and `l2nx.gslink.*`; the game settings stay in the `.ini` files of `config/`.

## Configuration

| Where                     | What                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `config/*.ini`            | game settings, client ports (game server only)                                                                                   |
| `config/application.yaml` | database, management port and address, logging, `l2nx.login.*`, `l2nx.network.*`, the GS-link (`spring.grpc.*`, `l2nx.gslink.*`) |
| environment variables     | override the Spring Boot keys of the file and of the built-in defaults                                                           |

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
server and 20 on the game server (`spring.datasource.hikari.maximum-pool-size`). The default password is for local
development only: set your own before the database is reachable from anywhere else.

The login server listens on one port per client protocol variant (`l2nx.login.client.ports`, a list of
`{port, variant}`; the shipped one is `2106` for `c621`, High Five clients). Its blocking work (decrypting the
credentials, the account lookup, the password check) runs at most `l2nx.login.client.max-concurrent-tasks` tasks at
once across all connections (default `32`); the others wait their turn.

An address that fails to log in `l2nx.login.ban.failed-logins` times (default `5`) is banned for
`l2nx.login.ban.duration` (default `15m`, `0` bans permanently). The failures count as one streak while each comes
within `l2nx.login.ban.failed-logins-window` of the previous one (default `15m`); a longer pause or a successful login
starts the count over.

Account passwords are stored as Argon2id hashes (16 MiB of memory, 2 iterations). On a 6-core desktop CPU one hash
takes about 18 ms of one core and allocates about 16.6 MiB, and 12 threads reach about 165 hashes per second. Each hash
holds its 16.6 MiB of heap while it runs, so the login server runs at most `l2nx.login.password.max-concurrent-hashes`
hashes at once (default `4`), whatever the number of processors; the others wait their turn. The default takes
4 × 16.6 MiB ≈ 66 MiB of the `-Xmx256m` heap the start script sets, and the rest stays for the server itself. Raise
the key and the heap together, by about 16.6 MiB of heap per extra hash, for example `max-concurrent-hashes: 12` with
the environment variable `LOGIN_SERVER_OPTS=-Xmx512m`. The wait for a slot is the timer `l2nx.login.password.wait`, the
hashes waiting the gauge `l2nx.login.password.queued`.

Both servers take their network limits and timeouts from `l2nx.network.*`; a key marked "game server" applies to the
game server only. The defaults suit a public server:

| Key                                                       | Default          | Meaning                                                                                                                                             |
| --------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `l2nx.network.transport`                                  | `auto`           | `auto` (epoll on Linux, NIO elsewhere), `epoll`, `nio`, `io-uring`                                                                                  |
| `l2nx.network.max-frame`                                  | `16KB`           | largest packet a client may send                                                                                                                    |
| `l2nx.network.read-timeout`                               | `120s`           | silence that closes a connection before it is authenticated (game server: until the account is accepted)                                            |
| `l2nx.network.handshake-timeout`                          | `10s`            | time from the connection to the protocol version (game server) or `AuthGameGuard` (login server)                                                    |
| `l2nx.network.auth-timeout`                               | `60s`            | time from the connection to a completed login or game server authentication                                                                         |
| `l2nx.network.ping-interval`                              | `30s`            | game server, once the account is accepted: silence that sends the client a ping                                                                     |
| `l2nx.network.ping-misses`                                | `3`              | game server: unanswered pings in a row that close the connection                                                                                    |
| `l2nx.network.inbound-queue-limit`                        | `256`            | game server: packets one client may have waiting; one more closes the connection                                                                    |
| `l2nx.network.packets-per-second`                         | `200`            | game server: sustained packets per second from one client, at most `1000000000`; bursts up to `inbound-queue-limit`                                 |
| `l2nx.network.packets-per-drain`                          | `16`             | game server: packets of one client run in one turn before other clients get theirs                                                                  |
| `l2nx.network.max-concurrent-drains`                      | `32`             | game server: clients whose packets run at the same time                                                                                             |
| `l2nx.network.decode-error-limit.count` / `.window`       | `10` / `60s`     | game server: malformed packets in the game, and failed packets at any stage, tolerated per client within the window before the connection is closed |
| `l2nx.network.connections-per-ip`                         | `10`             | concurrent connections from one address                                                                                                             |
| `l2nx.network.accept-per-ip-per-second`                   | `5`              | new connections per second from one address                                                                                                         |
| `l2nx.network.max-connections`                            | `10000`          | concurrent connections per server                                                                                                                   |
| `l2nx.network.outbound-limit`                             | `1MB`            | unsent data per connection before it is closed                                                                                                      |
| `l2nx.network.worker-threads`                             | `0`              | event loop threads; `0` takes twice the available processors                                                                                        |
| `l2nx.network.write-buffer-low` / `write-buffer-high`     | `32KB` / `128KB` | unsent data per connection above which the client counts as slow (`high`) and below which it recovers (`low`); see `slow-client-timeout`            |
| `l2nx.network.slow-client-timeout`                        | `10s`            | how long a connection may stay over `write-buffer-high` before it is closed                                                                         |
| `l2nx.network.shutdown-quiet-period` / `shutdown-timeout` | `2s` / `15s`     | on shutdown: quiet time before the event loops stop, and the most time clients get to receive the farewell                                          |

After authentication a login session is no longer bound by `read-timeout`: it stays open for at most 5 minutes in
total, then the server tells the client the session has expired and closes it, so the client returns to the login
screen.

## Login and game server link

The game server registers on the login server over the GS-link, a gRPC stream on the login server's port `9014`. Both
servers need the same secret of at least 32 characters (256 bits), printable ASCII without spaces, and refuse to start
without it or with a shorter one. Generate it with `openssl rand -base64 32` (44 characters) and pass it as an
environment variable:

```sh
export L2NX_GSLINK_SECRET=<the generated secret>
```

The login server listens on `127.0.0.1:9014` (`spring.grpc.server.address` and `.port`), and the game server connects
to `static://127.0.0.1:9014` (`spring.grpc.client.channel.login.target`), so two servers on one host need nothing else.
Plaintext is allowed on loopback only. Any other address needs TLS, or the server refuses to start: the secret would
travel in clear. TLS comes from a Spring Boot SSL bundle; the game server checks the login server's certificate and
the host name it connects to, and refuses to start with `bypass-certificate-validation`:

```yaml
# login server, config/application.yaml
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
# game server, config/application.yaml
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

`gslink-ca.crt` is the certificate of the authority that signed the login server's certificate, or that certificate
itself when it is self-signed ([Docker](#docker) shows how to create one).

Both ends send gRPC keepalive pings every 15 seconds and drop a peer that has not answered for 10 more
(`spring.grpc.server.keepalive.*`, `spring.grpc.client.channel.login.keepalive.*`). The game server opens a new stream
1 second after one ended, doubling the delay up to 30 seconds (`l2nx.gslink.reconnect-delay.initial` and `.max`). A
game server that registers with the hex id of a live stream is refused until that stream ends; a dead stream is closed
by keepalive within about 25 seconds. On shutdown the login server ends every
stream and waits up to 15 seconds for them (`spring.grpc.server.shutdown.grace-period`). The login server's port also
serves the standard gRPC health check, without the secret.

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

### Game loop (game server)

The game server runs the world on partition loops. The `l2nx.engine.*` keys of `application.yaml` tune them; the
defaults are starting points to be tuned under load.

| Key                                | Default       | Meaning                                                                                                         |
| ---------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------- |
| `l2nx.engine.pass-min`             | `5ms`         | minimum gap between passes run for input; due timers and systems never wait                                     |
| `l2nx.engine.pass-budget`          | `50ms`        | a longer pass is counted and logged with its phase breakdown                                                    |
| `l2nx.engine.trigger-depth`        | `8`           | generations of same-pass follow-up work drained in one pass                                                     |
| `l2nx.engine.packets-per-pass`     | `16`          | items one ready input source gives per pass                                                                     |
| `l2nx.engine.overdue-per-pass`     | `4096`        | overdue timers one timer queue fires per pass; the rest waits for the next pass                                 |
| `l2nx.engine.blocked-pass-warning` | `2s`          | a longer pass gets the loop thread's stack logged, once per multiple                                            |
| `l2nx.engine.blocked-pass-exit`    | not set (off) | a pass running longer exits the server so its supervisor restarts it; set it longer than `blocked-pass-warning` |

Durations are whole milliseconds, at least `1ms`; counts are positive. A wrong value stops the server at startup.
Stopping the loops is bounded by the standard `spring.lifecycle.timeout-per-shutdown-phase` (30 seconds by default).

The periodic systems of the world loop take their cadences from their own keys:

| Key                            | Default | Meaning                                                  |
| ------------------------------ | ------- | -------------------------------------------------------- |
| `l2nx.ai.think-cadence`        | `1s`    | think step of every monster and other attackable with AI |
| `l2nx.movement.player-cadence` | `50ms`  | position updates of moving players                       |
| `l2nx.movement.npc-cadence`    | `100ms` | position updates of every other moving creature          |

A watchdog thread checks the running pass every 500 ms. A pass that never ends (an endless loop in a script) freezes
the world, and the world cannot save from a frozen loop: `blocked-pass-exit` gives up the changes since the last save
for availability, which is why it is off by default. The exit stops the server in order, and the frozen loop holds that
stop for at most `timeout-per-shutdown-phase`. While the server stops, a blocked pass (a save stuck on the database)
still gets its stack logged, but it never triggers the exit. The startup pass that loads the world is not watched.

### Background tasks (game server)

Work that never touches the world, such as reading the custom mail queue from the database or measuring CPU and
memory load for the precautionary restart, runs off the world loop on Spring Boot's standard task scheduler and
executor; its result goes back to the world loop. The standard `spring.task.*` keys tune them:

| Key                                         | Default                 | Meaning                                          |
| ------------------------------------------- | ----------------------- | ------------------------------------------------ |
| `spring.task.scheduling.pool.size`          | `2`                     | threads for delayed and periodic background work |
| `spring.task.scheduling.thread-name-prefix` | `l2nx-background-`      | name prefix of the scheduler threads             |
| `spring.task.execution.pool.*`              | Spring Boot defaults    | the executor for immediate background work       |
| `spring.task.execution.thread-name-prefix`  | `l2nx-background-exec-` | name prefix of the executor threads              |

Leave `spring.threads.virtual.enabled` unset: with virtual threads Spring Boot builds a scheduler whose periodic runs
may overlap, and the key switches every other executor of the server too.

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

Then every connected client is told before its connection closes: the game server sends the server-close message (also
to players still on character selection), and the High Five client shows "You have been disconnected"; the login server
sends a login failure with the maintenance reason, shown as "We are currently undergoing game server maintenance" on
the login screen and on the server list. Clients get up to `l2nx.network.shutdown-timeout` (15 seconds) to receive it.

```sh
curl -s http://127.0.0.1:8777/actuator/health/readiness
curl -s -X POST -H 'Content-Type: application/json' -d '{"configuredLevel":"DEBUG"}' \
  http://127.0.0.1:8777/actuator/loggers/org.example
```

Metrics are the standard Spring Boot ones (JVM, process, system, log events, `hikaricp.*`, `tomcat.*`, `executor.*`
for the thread pools), tagged with `application`, plus `l2nx.network.*` (connections, bytes, drops, closes by reason),
`grpc.server.*` / `grpc.client.*` for the GS-link, `l2nx.players.online`, `l2nx.session.queue.depth` (items in a
client's input queue after each packet it sends, one histogram across all clients for p99 and maximum) and, on the game server, the `l2nx.engine.*` loop metrics (pass time and phases, passes over
budget, `l2nx.engine.pass.running` (seconds the running pass has taken so far, 0 between passes, so a blocked pass shows before it ends), inbox depth, timers, failures, calls from a thread that does not own the loop; `l2nx.engine.jdbc.on.loop`, the time
loop threads spend in JDBC calls until database work moves off the loop, with a `WARN` naming the calling code once per site and minute) and `l2nx.legacy.packet` (run time per client
packet).

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
  (`docker stop --time 120`, Compose `stop_grace_period`); the Docker default of 10 seconds is not enough. The login
  server waits up to 15 seconds for the GS-link streams to end, so it needs a longer stop timeout too.

A container has no loopback that another container can reach, so the login server's gRPC server listens on the
container's interface (`0.0.0.0`) and, as for any address other than loopback, requires TLS: without the SSL bundle
the server refuses to start. Create a self-signed certificate that names the host the game server connects to, once,
outside the containers:

```sh
openssl req -x509 -newkey rsa:3072 -nodes -days 825 \
  -keyout gslink.key -out gslink.crt \
  -subj "/CN=login-host" -addext "subjectAltName=DNS:login-host"
```

The `CN` and the subject alternative name must equal the host in `SPRING_GRPC_CLIENT_CHANNEL_LOGIN_TARGET`, since the
game server checks the host name. The image runs as a non-root user, so `gslink.key` must be readable for its uid
(`docker run --rm --entrypoint id l2nx/login-server -u` prints it). Mount `gslink.key` and `gslink.crt` read-only into
the login server container and `gslink.crt` alone into the game server container (a self-signed certificate is its
own trust anchor). Both containers take the same `L2NX_GSLINK_SECRET`, and the SSL bundle is set with the properties
of [the link section](#login-and-game-server-link) as environment variables:

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

The game server's client ports are still set in the `.ini` files, so a login and game pair cannot yet be configured in
Compose; run them as distributions until then.

## Restart

The process never restarts itself. It exits with a code, and the supervisor decides.

| Exit code | Meaning                                  | Supervisor       |
| --------- | ---------------------------------------- | ---------------- |
| 0         | stopped on purpose (shutdown)            | does not restart |
| 1         | startup failure or crash                 | restarts         |
| 2         | restart requested (command, schedule)    | restarts         |
| 3         | out of memory (`ExitOnOutOfMemoryError`) | restarts         |
| 143       | stopped by SIGTERM                       | does not restart |

Docker: `--restart on-failure` (or `restart: on-failure` in Compose) restarts on 1, 2 and 3 and leaves `docker stop`
alone.

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

`SuccessExitStatus=143` makes `systemctl stop` a clean stop; `RestartForceExitStatus=2` restarts on a requested restart
whatever the other settings say. `gslink.env` holds `L2NX_GSLINK_SECRET=…` and can be readable by root only, since
systemd reads it before it starts the server; the login server's unit loads the same file.
