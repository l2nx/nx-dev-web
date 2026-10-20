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

This starts PostgreSQL 18 on `127.0.0.1:5432` with the database `l2nx`, and on the first start creates one role and
one schema per server: `l2nx_login` owns `login`, `l2nx_game` owns `game`. The servers create their tables
themselves at start (Liquibase). This matches the defaults of both servers (`spring.datasource.*`): password `l2nx`.
The port is open to your machine only; change the passwords before you expose the database anywhere else, and set the
same ones for the servers in `config/application.yaml` (see [operations](/l2/operations/)). To set up a database
without Compose, see [the database section of operations](/l2/operations/#database).

The roles and schemas are created only when the volume is created. Before 1.0 each server has a single schema
baseline that is edited in place, so after you pull a change that touches the database, recreate it with
`docker compose down -v` and `docker compose up -d`; this deletes the local data. A Liquibase checksum error at start
means exactly this.

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

| Directory                                             | Contents                              |
| ----------------------------------------------------- | ------------------------------------- |
| `login/boot/build/install/login-server`               | `bin/login-server`, `config/`         |
| `chronicles/high-five/boot/build/install/game-server` | `bin/game-server`, `config/`, `data/` |

The servers run headless. A restart from the game or by schedule exits with code 2, a crash with another non-zero
code, a shutdown with 0: run the server under a supervisor that restarts it on a non-zero exit (systemd
`Restart=on-failure`, Docker `restart: on-failure`; examples in [operations](/l2/operations/#restart)). `./gradlew distZip` packs the same directories into archives.

The build rewrites everything in these directories that comes from the sources, including `config/`. It keeps `log/` and
`data/geodata/`.

## Geodata

Geodata is not shipped. Put the files into `data/geodata` of the game server directory; the format and the path are
set in `config/GeoEngine.ini`.
