---
title: Вебхуки
description: Приём вебхука vote.created от l2nx.top, проверка подписи и обработка повторов.
---

Когда игрок голосует за ваш проект, l2nx.top отправляет на ваш эндпоинт вебхук `vote.created`. Вебхуки следуют
[Standard Webhooks](https://www.standardwebhooks.com/): HTTPS `POST` с JSON-телом, подписанный HMAC-SHA256.

Эндпоинт и его секрет настраиваются по запросу: см. [Получение доступа](/ru/top/getting-access/).

## Требования к эндпоинту

- Только `https://`, порт 443, без имени пользователя и пароля в URL.
- Хост должен резолвиться только в публичные адреса.
- Редиректы не выполняются: ответ `3xx` считается неудачной попыткой.
- Ответьте любым `2xx` в течение **10 секунд**. Всё остальное (другой статус, таймаут, ошибка соединения) — неудачная
  попытка, она будет повторена.

## Запрос

```http title="Request"
POST /your/webhook/path HTTP/1.1
Content-Type: application/json
webhook-id: 0198f3c2-7b20-7c11-8e3f-2a9d4c6b1e05
webhook-timestamp: 1791797601
webhook-signature: v1,VoEoIgG2+YIaxaT1NlPXmryWL7s75ig5llw+xhf1tZw=

{"type":"vote.created","timestamp":"2026-10-12T09:33:20Z","data":{"id":"0198f3c2-7b1e-7a55-9d3a-5f6c1e2b4a10","tenantSlug":"myproject","serverSlug":"x100","ref":"5f0c6b2e9a8d4c1f","ip":"203.0.113.7","createdAt":"2026-10-12T09:33:20Z"}}
```

### Заголовки

| Заголовок           | Смысл                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `webhook-id`        | Id события (UUID). Одинаков во всех повторах одного события: по нему дедуплицируйте.     |
| `webhook-timestamp` | Время этой попытки доставки, Unix-секунды. Меняется при каждом повторе.                  |
| `webhook-signature` | Список подписей `v1,<base64>` через пробел. Обычно одна, две — на время ротации секрета. |

### Тело

| Поле        | Тип    | Смысл                                                                        |
| ----------- | ------ | ---------------------------------------------------------------------------- |
| `type`      | string | Тип события, `vote.created`. Типы, которые вы не обрабатываете, игнорируйте. |
| `timestamp` | string | Когда отдан голос, ISO 8601 UTC.                                             |
| `data`      | object | Голос, см. ниже.                                                             |

`data` события `vote.created`:

| Поле         | Тип            | Смысл                                                                                                |
| ------------ | -------------- | ---------------------------------------------------------------------------------------------------- |
| `id`         | string (UUID)  | Id голоса. Он же курсор ленты голосов.                                                               |
| `tenantSlug` | string         | Slug вашего проекта на момент голоса.                                                                |
| `serverSlug` | string, `null` | Сервер, который выбрал игрок; `null`, если не выбран.                                                |
| `ref`        | string, `null` | `ref` из вашей [ссылки для голосования](/ru/top/vote-link/) без изменений; `null`, если его не было. |
| `ip`         | string         | IP-адрес голосующего, IPv4 или IPv6. В вебхуке есть всегда.                                          |
| `createdAt`  | string         | Время голоса, ISO 8601 UTC. Может содержать доли секунды.                                            |

В тело и в `data` могут добавляться новые поля без смены версии. Незнакомые поля игнорируйте.

## Повторы

Неудачная попытка повторяется по расписанию Standard Webhooks. Задержка после предыдущей попытки:

| Попытка  | 1     | 2   | 3     | 4      | 5   | 6   | 7    | 8    |
| -------- | ----- | --- | ----- | ------ | --- | --- | ---- | ---- |
| Задержка | сразу | 5 с | 5 мин | 30 мин | 2 ч | 5 ч | 10 ч | 10 ч |

После 8 неудачных попыток (около 27 часов) событие отбрасывается. Голоса, которые ваш эндпоинт пропустил, забирайте
из [ленты голосов](#опрос-ленты-голосов).

## Обработка событий

- **Сначала проверьте подпись** — по сырому телу, до разбора JSON. Невалидный запрос отклоняйте с `401`.
- **Дедуплицируйте.** Одно событие может прийти больше одного раза (например, повтор после таймаута на вашей стороне).
  Сохраняйте `webhook-id` и пропускайте уже обработанные события. Если вы ещё и опрашиваете ленту, дедуплицируйте
  награды по id голоса `data.id`: лента отдаёт тот же id.
- **Не полагайтесь на порядок.** Из-за повторов старое событие может прийти после нового.
- **Отвечайте быстро.** Положите событие в свою очередь или таблицу и верните `2xx`; награду выдавайте асинхронно.

## Проверка подписи

1. Возьмите секрет, отбросьте префикс `whsec_` и декодируйте остаток из base64: эти байты — ключ HMAC.
2. Соберите подписываемую строку: `{webhook-id}.{webhook-timestamp}.{сырое тело}`.
3. Посчитайте от неё HMAC-SHA256 и закодируйте результат в base64.
4. Разбейте `webhook-signature` по пробелам. Запрос валиден, если любая запись `v1,` равна вашему значению.
   Сравнивайте за постоянное время.
5. Отклоните запрос, если `webhook-timestamp` отличается от ваших часов больше чем на 5 минут. Это защищает от
   повторной отправки перехваченных запросов; держите часы сервера синхронизированными.

:::caution
Проверяйте подпись по телу ровно в том виде, в каком оно пришло. Фреймворк, который разбирает и заново сериализует
JSON, меняет байты, и подпись перестаёт совпадать.
:::

Любая [библиотека Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks) делает ту же проверку.
Примеры ниже используют только стандартную библиотеку своего языка.

### Java

Java 8 или новее, без зависимостей.

```java title="L2nxWebhookVerifier.java"
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class L2nxWebhookVerifier {

    private static final long TOLERANCE_SECONDS = 5 * 60;
    private static final String SECRET_PREFIX = "whsec_";

    private final byte[] key;

    public L2nxWebhookVerifier(String secret) {
        String encoded = secret.startsWith(SECRET_PREFIX) ? secret.substring(SECRET_PREFIX.length()) : secret;
        this.key = Base64.getDecoder().decode(encoded);
    }

    /** {@code body} must be the raw request body, byte for byte. */
    public boolean verify(String id, String timestamp, String signatureHeader, byte[] body)
            throws GeneralSecurityException {
        long sentAt;
        try {
            sentAt = Long.parseLong(timestamp);
        } catch (NumberFormatException e) {
            return false;
        }
        if (Math.abs(System.currentTimeMillis() / 1000 - sentAt) > TOLERANCE_SECONDS) {
            return false;
        }
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        mac.update((id + "." + timestamp + ".").getBytes(StandardCharsets.UTF_8));
        byte[] expected = Base64.getEncoder().encode(mac.doFinal(body));
        for (String entry : signatureHeader.split(" ")) {
            if (entry.startsWith("v1,")
                    && MessageDigest.isEqual(expected, entry.substring(3).getBytes(StandardCharsets.US_ASCII))) {
                return true;
            }
        }
        return false;
    }
}
```

В Spring MVC читайте тело как `byte[]`, чтобы оно не сериализовалось заново:

```java title="L2nxWebhookController.java"
import java.security.GeneralSecurityException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class L2nxWebhookController {

    private final L2nxWebhookVerifier verifier = new L2nxWebhookVerifier(System.getenv("L2NX_WEBHOOK_SECRET"));

    @PostMapping("/l2nx/webhook")
    public ResponseEntity<Void> receive(
            @RequestHeader("webhook-id") String id,
            @RequestHeader("webhook-timestamp") String timestamp,
            @RequestHeader("webhook-signature") String signature,
            @RequestBody byte[] body)
            throws GeneralSecurityException {
        if (!verifier.verify(id, timestamp, signature, body)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        // Deduplicate by id, store the event, grant the reward asynchronously.
        return ResponseEntity.noContent().build();
    }
}
```

### PHP

PHP 7.4 или новее, без расширений сверх стандартных.

```php title="l2nx-webhook.php"
<?php

function l2nx_verify_webhook(string $secret, string $id, string $timestamp, string $signatureHeader, string $body): bool
{
    if (preg_match('/^\d+$/', $timestamp) !== 1 || abs(time() - (int) $timestamp) > 300) {
        return false;
    }
    $key = base64_decode(preg_replace('/^whsec_/', '', $secret), true);
    if ($key === false) {
        throw new InvalidArgumentException('Malformed webhook secret');
    }
    $expected = base64_encode(hash_hmac('sha256', $id . '.' . $timestamp . '.' . $body, $key, true));
    foreach (explode(' ', $signatureHeader) as $entry) {
        $parts = explode(',', $entry, 2);
        if (count($parts) === 2 && $parts[0] === 'v1' && hash_equals($expected, $parts[1])) {
            return true;
        }
    }
    return false;
}

$body = file_get_contents('php://input');
$id = $_SERVER['HTTP_WEBHOOK_ID'] ?? null;
$timestamp = $_SERVER['HTTP_WEBHOOK_TIMESTAMP'] ?? null;
$signature = $_SERVER['HTTP_WEBHOOK_SIGNATURE'] ?? null;

if ($id === null || $timestamp === null || $signature === null
    || !l2nx_verify_webhook(getenv('L2NX_WEBHOOK_SECRET'), $id, $timestamp, $signature, $body)) {
    http_response_code(401);
    exit;
}

$event = json_decode($body, true);
// Deduplicate by $id, store $event, grant the reward asynchronously.
http_response_code(204);
```

### Node.js

Node.js 18 или новее, без зависимостей.

```js title="l2nx-webhook.mjs"
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const TOLERANCE_SECONDS = 5 * 60;

export function verifyL2nxWebhook(
  secret,
  id,
  timestamp,
  signatureHeader,
  body,
) {
  if (
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS
  ) {
    return false;
  }
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = Buffer.from(
    createHmac("sha256", key)
      .update(`${id}.${timestamp}.`)
      .update(body)
      .digest("base64"),
  );
  return signatureHeader.split(" ").some((entry) => {
    if (!entry.startsWith("v1,")) {
      return false;
    }
    const candidate = Buffer.from(entry.slice(3));
    return (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    );
  });
}

createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const id = req.headers["webhook-id"];
    const timestamp = req.headers["webhook-timestamp"];
    const signature = req.headers["webhook-signature"];
    if (
      !id ||
      !timestamp ||
      !signature ||
      !verifyL2nxWebhook(
        process.env.L2NX_WEBHOOK_SECRET,
        id,
        timestamp,
        signature,
        body,
      )
    ) {
      res.writeHead(401).end();
      return;
    }
    const event = JSON.parse(body.toString("utf8"));
    // Deduplicate by id, store the event, grant the reward asynchronously.
    res.writeHead(204).end();
  });
}).listen(8080);
```

Запускайте его за своим HTTPS reverse proxy: l2nx.top доставляет только на порт 443.

### Проверка своего кода

[Запрос выше](#запрос) подписан тестовым секретом `whsec_1UzhPzSh1U6v5xtuugrtt52qBlyyyGi396CrL5mcBJQ=`. Передайте
своему верификатору его `webhook-id`, `webhook-timestamp`, `webhook-signature` и тело (одна строка, без перевода
строки в конце): он должен принять запрос, если на время теста отключить 5-минутную проверку, и отклонить его при
изменении любого байта тела.

## Ротация секрета

При ротации секрета 24 часа доставки подписываются и старым, и новым секретом, поэтому в `webhook-signature` две
записи. Переключите эндпоинт на новый секрет в этом окне. Примеры выше уже принимают любую совпавшую запись.

## Опрос ленты голосов

Вебхуки — быстрый путь. Лента голосов [Integration API](/ru/api/overview/) — источник, из которого можно догнать
пропущенное: после простоя на вашей стороне или после того, как у события кончились повторы.

- `GET https://api.l2nx.top/top/v1/integration/votes?after={voteId}&limit={1..500}` возвращает `{"votes": [...]}`:
  голоса вашего проекта в порядке id, начиная после `after` (без него — с самого старого голоса). `limit` по
  умолчанию 100. Пустой список — конец ленты: опросите позже с id последнего полученного голоса.
- `POST https://api.l2nx.top/top/v1/integration/votes/lookup` с `{"refs": [...]}` (от 1 до 500 значений) возвращает
  все голоса с любым из этих `ref`. `ref` без голоса просто отсутствует в ответе.

У голосов ленты те же поля, что у `data` вебхука. Голос появляется в ленте примерно через 10 секунд после того, как
отдан, а `ip` становится `null`, когда голосу больше 90 дней.

Оба вызова требуют API key со scope `top.votes:read`: см. [Аутентификация](/ru/api/authentication/).
