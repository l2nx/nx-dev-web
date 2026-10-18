---
title: nx-gs-kafka
description: Лёгкий клиент Kafka для ядер игровых серверов на Java 8+, которым пользуются остальные модули адаптера.
sidebar:
  order: 8
---

Небольшой фасад клиента Kafka для Java 8 и новее: producer и consumers с JSON-сериализацией, отслеживанием состояния
соединения и переподключением. Модули адаптера публикуют через него; настройки подключения приходят с платформы при
подключении.

## Координаты

```text
app.l2nx:nx-gs-kafka
```

Java 8. Тег релиза `kafka/vX.Y.Z`. Версии — на
[Maven Central](https://central.sonatype.com/artifact/app.l2nx/nx-gs-kafka).

## Когда нужен хосту

Приходит транзитивно с [`nx-gs-adapter-core`](/ru/adapter/modules/nx-gs-adapter-core/); объявлять его не нужно.
Зависит от `org.apache.kafka:kafka-clients` без нативных библиотек сжатия: чтобы использовать сжатие `lz4`, `snappy`
или `zstd`, добавьте JAR соответствующей библиотеки сами.

## Конфигурация

Настройки producer задаются ключами core `l2nx.kafka.producer.*`:
[конфигурация → nx-gs-adapter-core](/ru/adapter/configuration/#nx-gs-adapter-core).
