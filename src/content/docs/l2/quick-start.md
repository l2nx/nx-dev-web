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

This starts MariaDB on `127.0.0.1:3306` and creates the database `l2jmobiush5` with the full schema on the first
start. It matches the defaults in `config/Database.ini` of both servers: user `root` without a password. The port is
open to your machine only; change the password in `Database.ini` before you expose the database anywhere else.

## Servers

```sh
./gradlew :login:boot:run
./gradlew :chronicles:high-five:boot:run
```

The login server accepts clients on port `2106`. The game server registers on it and accepts clients on port `7777`.
Accounts are created on the first login (`AutoCreateAccounts` in the login `Server.ini`).

High Five clients with protocol revisions 267, 268, 271 and 273 are accepted (`AllowedProtocolRevisions` in the game
`Server.ini`).

## Distributions

```sh
./gradlew installDist
```

builds two runnable directories:

| Directory                                             | Contents                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| `login/boot/build/install/login-server`               | `bin/login-server`, `bin/account-manager`, `bin/game-server-register`, `config/` |
| `chronicles/high-five/boot/build/install/game-server` | `bin/game-server`, `config/`, `data/`                                            |

`GameServer.sh` and `LoginServer.sh` in them run the server in a loop that restarts it after an in-game restart.
`./gradlew distZip` packs the same directories into archives.

The build rewrites everything in these directories that comes from the sources, including `config/`. It keeps `log/`,
`backup/` and `data/geodata/`.

## Geodata

Geodata is not shipped. Put the files into `data/geodata` of the game server directory; the format and the path are
set in `config/GeoEngine.ini`.
