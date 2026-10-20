---
title: Quick start
description: Build nx-l2, start the database, the login server and the High Five game server on your machine.
---

You need JDK 25 and Docker. On Windows, clone with `git clone -c core.longpaths=true`: some script paths are
longer than the Windows path limit allows by default.

## Database

```sh
docker compose up -d
```

This starts MariaDB on `127.0.0.1:3306` and creates the database `l2nx` with the full schema on the first start. It
matches the defaults of both servers (`spring.datasource.*`): user `l2nx`, password `l2nx`. The port is open to your
machine only; change the password before you expose the database anywhere else, and set the same one for the servers in
`config/application.yaml` (see [operations](/l2/operations/)). The database moves to PostgreSQL at stage 3.

The schema is applied only when the volume is created. After you pull a change to `datapack/sql/*.sql` (the skill
and item reuse columns changed with the game clock), recreate the database with `docker compose down -v` and
`docker compose up -d`; this deletes the local data.

## Servers

```sh
./gradlew :login:boot:run
./gradlew :chronicles:high-five:boot:run
```

The login server accepts clients on port `2106`. The game server registers on it and accepts clients on port `7777`.
Accounts are created on the first login (`l2nx.login.auto-create-accounts` in the login `application.yaml`).

High Five clients with protocol revisions 267, 268, 271 and 273 are accepted (`AllowedProtocolRevisions` in the game
`Server.ini`).

## Distributions

```sh
./gradlew installDist
```

builds two runnable directories:

| Directory                                             | Contents                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `login/boot/build/install/login-server`               | `bin/login-server`, `config/`                                                    |
| `chronicles/high-five/boot/build/install/game-server` | `bin/game-server`, `config/`, `data/`                                            |

The servers run headless. A restart from the game or by schedule exits with code 2, a crash with another non-zero
code, a shutdown with 0: run the server under a supervisor that restarts it on a non-zero exit (systemd
`Restart=on-failure`, Docker `restart: on-failure`; examples in [operations](/l2/operations/#restart)). `./gradlew distZip` packs the same directories into archives.

The build rewrites everything in these directories that comes from the sources, including `config/`. It keeps `log/` and
`data/geodata/`.

## Geodata

Geodata is not shipped. Put the files into `data/geodata` of the game server directory; the format and the path are
set in `config/GeoEngine.ini`.
